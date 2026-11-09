use std::env;

use tracing_subscriber::EnvFilter;

#[derive(Clone, Debug)]
pub struct Config {
    pub bind_addr: String,
    pub database_url: String,
    pub database_read_url: Option<String>,
    pub redis_url: String,
    pub s3_endpoint: String,
    pub s3_bucket: String,
    pub s3_access_key: String,
    pub s3_secret_key: String,
    pub public_files_prefix: String,
    pub stun_urls: Vec<String>,
}

fn var(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            bind_addr: var("BIND_ADDR", "0.0.0.0:3000"),
            database_url: var("DATABASE_URL", "mysql://glacier:glacier@127.0.0.1:3306/glacier"),
            database_read_url: env::var("DATABASE_READ_URL").ok().filter(|v| !v.is_empty()),
            redis_url: var("REDIS_URL", "redis://127.0.0.1:6379"),
            s3_endpoint: var("S3_ENDPOINT", "http://127.0.0.1:9000"),
            s3_bucket: var("S3_BUCKET", "glacier-uploads"),
            s3_access_key: var("S3_ACCESS_KEY", "glacier"),
            s3_secret_key: var("S3_SECRET_KEY", "glacier-secret"),
            public_files_prefix: var("PUBLIC_FILES_PREFIX", "/files"),
            stun_urls: var("STUN_URLS", "stun:stun.l.google.com:19302")
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
        }
    }
}

pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| "glacier=info,tower_http=info".into());
    tracing_subscriber::fmt().with_env_filter(filter).init();
}
