use std::ops::Deref;
use std::sync::Arc;

use aws_sdk_s3::config::{BehaviorVersion, Credentials, Region};
use metrics_exporter_prometheus::PrometheusHandle;
use redis::aio::ConnectionManager;

use crate::config::Config;
use crate::db::Db;
use crate::gateway::Hub;
use crate::id::Snowflake;

#[derive(Clone)]
pub struct AppState(Arc<Inner>);

pub struct Inner {
    pub db: Db,
    pub redis: ConnectionManager,
    pub redis_client: redis::Client,
    pub s3: aws_sdk_s3::Client,
    pub bucket: String,
    pub files_prefix: String,
    pub stun_urls: Vec<String>,
    pub ids: Snowflake,
    pub hub: Hub,
    pub metrics: PrometheusHandle,
}

impl Deref for AppState {
    type Target = Inner;
    fn deref(&self) -> &Inner {
        &self.0
    }
}

type BoxError = Box<dyn std::error::Error + Send + Sync>;

impl AppState {
    pub async fn build(config: &Config) -> Result<Self, BoxError> {
        let metrics = crate::metrics::install()?;
        let db = Db::connect(&config.database_url, config.database_read_url.as_deref()).await?;
        let redis_client = redis::Client::open(config.redis_url.as_str())?;
        let mut redis = ConnectionManager::new(redis_client.clone()).await?;

        // Each replica claims a distinct snowflake worker id.
        let seq: u64 = redis::cmd("INCR")
            .arg("glacier:worker_seq")
            .query_async(&mut redis)
            .await?;
        let ids = Snowflake::new(seq % 1024);

        let s3 = s3_client(config);
        ensure_bucket(&s3, &config.s3_bucket).await;

        Ok(Self(Arc::new(Inner {
            db,
            redis,
            redis_client,
            s3,
            bucket: config.s3_bucket.clone(),
            files_prefix: config.public_files_prefix.trim_end_matches('/').to_string(),
            stun_urls: config.stun_urls.clone(),
            ids,
            hub: Hub::default(),
            metrics,
        })))
    }

    /// Cheap clone of the multiplexed redis connection.
    pub fn redis(&self) -> ConnectionManager {
        self.redis.clone()
    }
}

fn s3_client(config: &Config) -> aws_sdk_s3::Client {
    let creds = Credentials::new(&config.s3_access_key, &config.s3_secret_key, None, None, "static");
    let conf = aws_sdk_s3::Config::builder()
        .behavior_version(BehaviorVersion::latest())
        .endpoint_url(&config.s3_endpoint)
        .credentials_provider(creds)
        .region(Region::new("us-east-1"))
        .force_path_style(true)
        .build();
    aws_sdk_s3::Client::from_conf(conf)
}

/// Creates the uploads bucket if needed and makes objects publicly readable
/// (nginx serves them under /files without credentials).
async fn ensure_bucket(s3: &aws_sdk_s3::Client, bucket: &str) {
    if s3.head_bucket().bucket(bucket).send().await.is_err() {
        if let Err(e) = s3.create_bucket().bucket(bucket).send().await {
            tracing::warn!(error = %e, bucket, "could not create bucket (it may already exist)");
        }
    }
    let policy = serde_json::json!({
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": { "AWS": ["*"] },
            "Action": ["s3:GetObject"],
            "Resource": [format!("arn:aws:s3:::{bucket}/*")]
        }]
    });
    if let Err(e) = s3
        .put_bucket_policy()
        .bucket(bucket)
        .policy(policy.to_string())
        .send()
        .await
    {
        tracing::warn!(error = %e, bucket, "could not set public-read bucket policy");
    }
}
