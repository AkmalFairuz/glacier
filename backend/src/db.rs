use sqlx::mysql::{MySqlPool, MySqlPoolOptions};

/// Primary (writer) and replica (reader) pools. Without a replica URL the
/// reader is the writer pool.
#[derive(Clone)]
pub struct Db {
    pub writer: MySqlPool,
    pub reader: MySqlPool,
}

impl Db {
    pub async fn connect(write_url: &str, read_url: Option<&str>) -> Result<Self, sqlx::Error> {
        let writer = pool(write_url).await?;
        let reader = match read_url {
            Some(url) => pool(url).await?,
            None => writer.clone(),
        };
        Ok(Self { writer, reader })
    }

    /// Runs migrations on the primary under a named lock so that replicas
    /// starting at the same time apply them exactly once.
    pub async fn migrate(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.writer.acquire().await?;
        let (locked,): (Option<i64>,) = sqlx::query_as("SELECT GET_LOCK('glacier_migrations', 120)")
            .fetch_one(&mut *conn)
            .await?;
        if locked != Some(1) {
            return Err("timed out waiting for the migration lock".into());
        }
        let mut migrator = sqlx::migrate!("./migrations");
        migrator.set_locking(false);
        let result = migrator.run(&mut *conn).await;
        sqlx::query("SELECT RELEASE_LOCK('glacier_migrations')")
            .execute(&mut *conn)
            .await?;
        Ok(result?)
    }
}

async fn pool(url: &str) -> Result<MySqlPool, sqlx::Error> {
    MySqlPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(url)
        .await
}

/// Maps a fieldless enum to a SQL string/ENUM column. sqlx's derived enums
/// do not decode MariaDB ENUM columns, so this goes through `&str`.
macro_rules! sql_string_enum {
    ($ty:ty { $($variant:ident => $text:literal),+ $(,)? }) => {
        impl $ty {
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $text),+ }
            }
        }

        impl std::str::FromStr for $ty {
            type Err = String;
            fn from_str(s: &str) -> Result<Self, String> {
                match s { $($text => Ok(Self::$variant),)+ other => Err(format!("unknown {} value {other}", stringify!($ty))) }
            }
        }

        impl sqlx::Type<sqlx::MySql> for $ty {
            fn type_info() -> sqlx::mysql::MySqlTypeInfo {
                <str as sqlx::Type<sqlx::MySql>>::type_info()
            }
            fn compatible(ty: &sqlx::mysql::MySqlTypeInfo) -> bool {
                <str as sqlx::Type<sqlx::MySql>>::compatible(ty)
            }
        }

        impl sqlx::Encode<'_, sqlx::MySql> for $ty {
            fn encode_by_ref(&self, buf: &mut Vec<u8>) -> Result<sqlx::encode::IsNull, sqlx::error::BoxDynError> {
                <&str as sqlx::Encode<sqlx::MySql>>::encode(self.as_str(), buf)
            }
        }

        impl<'r> sqlx::Decode<'r, sqlx::MySql> for $ty {
            fn decode(value: sqlx::mysql::MySqlValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
                Ok(<&str as sqlx::Decode<sqlx::MySql>>::decode(value)?.parse()?)
            }
        }
    };
}

pub(crate) use sql_string_enum;
