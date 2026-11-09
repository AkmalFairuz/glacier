//! Fetching link previews without letting a message reach inside our network (SSRF).
//!
//! - Only http and https on the default ports.
//! - Host names resolve through [`PublicOnly`], which drops private, loopback, link-local and
//!   other non-public addresses, so the connection can only go to a public IP. IP literals are
//!   checked the same way, on the first URL and on every redirect.
//! - At most 3 redirects, 5 seconds per request, 512 KB of HTML and 2 MB per image.
use std::net::{IpAddr, SocketAddr};
use std::sync::OnceLock;
use std::time::Duration;

use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use reqwest::{redirect, Client, Response, Url};
use scraper::{Html, Selector};

const TIMEOUT: Duration = Duration::from_secs(5);
const MAX_HTML: usize = 512 * 1024;
pub const MAX_IMAGE: usize = 2 * 1024 * 1024;
const MAX_REDIRECTS: usize = 3;

/// True for addresses on the public internet.
pub fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let [a, b, c, _] = v4.octets();
            !(v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_documentation()
                || v4.is_unspecified()
                || v4.is_multicast()
                || a == 0
                || a >= 240
                || (a == 100 && (b & 0xc0) == 64) // carrier-grade NAT, 100.64.0.0/10
                || (a == 192 && b == 0 && c == 0) // IETF protocol assignments
                || (a == 198 && (b & 0xfe) == 18)) // benchmarking, 198.18.0.0/15
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_public(IpAddr::V4(v4));
            }
            let s = v6.segments();
            !(v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || (s[0] & 0xfe00) == 0xfc00 // unique local
                || (s[0] & 0xffc0) == 0xfe80 // link-local
                || (s[0] == 0x2001 && s[1] == 0x0db8) // documentation
                || (s[0] == 0x0064 && s[1] == 0xff9b)) // NAT64
        }
    }
}

/// Whether a URL may be fetched at all (before DNS).
pub fn allowed(url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    if !matches!(url.port_or_known_default(), Some(80 | 443)) {
        return false;
    }
    match url.host() {
        Some(url::Host::Ipv4(ip)) => is_public(IpAddr::V4(ip)),
        Some(url::Host::Ipv6(ip)) => is_public(IpAddr::V6(ip)),
        Some(url::Host::Domain(d)) => {
            let d = d.trim_end_matches('.').to_ascii_lowercase();
            // Single-label names are Docker service names (redis, minio, backend, ...).
            d.contains('.') && !d.ends_with(".localhost") && !d.ends_with(".internal") && !d.ends_with(".local")
        }
        None => false,
    }
}

/// Resolves host names but only returns public addresses.
struct PublicOnly;

impl Resolve for PublicOnly {
    fn resolve(&self, name: Name) -> Resolving {
        let host = name.as_str().to_string();
        Box::pin(async move {
            let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host.as_str(), 0))
                .await?
                .filter(|a| is_public(a.ip()))
                .collect();
            if addrs.is_empty() {
                return Err(format!("{host} does not resolve to a public address").into());
            }
            Ok(Box::new(addrs.into_iter()) as Addrs)
        })
    }
}

fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .dns_resolver(PublicOnly)
            .redirect(redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= MAX_REDIRECTS {
                    attempt.error("too many redirects")
                } else if !allowed(attempt.url()) {
                    attempt.error("redirect to a blocked address")
                } else {
                    attempt.follow()
                }
            }))
            .timeout(TIMEOUT)
            .connect_timeout(Duration::from_secs(3))
            .no_proxy()
            .user_agent("Mozilla/5.0 (compatible; GlacierBot/1.0; link previews)")
            .build()
            .expect("link preview http client")
    })
}

/// Reads at most `max` bytes. `None` when the body is larger and `truncate` is false.
async fn read_limited(mut res: Response, max: usize, truncate: bool) -> Option<Vec<u8>> {
    let mut body = Vec::new();
    while let Some(chunk) = res.chunk().await.ok()? {
        if body.len() + chunk.len() > max {
            if !truncate {
                return None;
            }
            body.extend_from_slice(&chunk[..max - body.len()]);
            break;
        }
        body.extend_from_slice(&chunk);
    }
    Some(body)
}

fn content_type(res: &Response) -> String {
    res.headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
}

/// Open Graph (or Twitter card, or plain HTML) metadata of a page.
#[derive(Debug, PartialEq)]
pub struct PageMeta {
    pub site_name: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    /// Absolute URL of the preview image.
    pub image: Option<Url>,
}

pub async fn fetch_page(url: &Url) -> Option<PageMeta> {
    if !allowed(url) {
        return None;
    }
    let res = client().get(url.clone()).send().await.ok()?;
    if !res.status().is_success() || content_type(&res) != "text/html" {
        return None;
    }
    let base = res.url().clone();
    let body = read_limited(res, MAX_HTML, true).await?;
    parse(&String::from_utf8_lossy(&body), &base)
}

/// An image download: bytes and their content type (png, jpeg, gif or webp only).
pub async fn fetch_image(url: &Url) -> Option<(Vec<u8>, &'static str)> {
    if !allowed(url) {
        return None;
    }
    let res = client().get(url.clone()).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let kind = match content_type(&res).as_str() {
        "image/png" => "image/png",
        "image/jpeg" | "image/jpg" => "image/jpeg",
        "image/gif" => "image/gif",
        "image/webp" => "image/webp",
        _ => return None,
    };
    Some((read_limited(res, MAX_IMAGE, false).await?, kind))
}

fn clip(s: &str, max: usize) -> Option<String> {
    let s = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if s.is_empty() {
        return None;
    }
    Some(if s.chars().count() > max {
        let mut cut: String = s.chars().take(max - 1).collect();
        cut.push('…');
        cut
    } else {
        s
    })
}

pub fn parse(html: &str, base: &Url) -> Option<PageMeta> {
    let doc = Html::parse_document(html);
    let meta = Selector::parse("meta").expect("selector");
    let mut tags = std::collections::HashMap::new();
    for el in doc.select(&meta) {
        let v = el.value();
        let (Some(key), Some(content)) = (v.attr("property").or_else(|| v.attr("name")), v.attr("content")) else {
            continue;
        };
        // Some sites ship empty tags (`og:title=""`); treat those as missing so fallbacks apply.
        if !content.trim().is_empty() {
            tags.entry(key.to_ascii_lowercase())
                .or_insert_with(|| content.to_string());
        }
    }
    let get = |keys: &[&str]| keys.iter().find_map(|k| tags.get(*k).map(String::as_str));
    let title_tag = Selector::parse("title").expect("selector");
    let html_title = doc.select(&title_tag).next().map(|t| t.text().collect::<String>());

    let title = get(&["og:title", "twitter:title"])
        .map(str::to_string)
        .or(html_title)
        .and_then(|t| clip(&t, 256));
    let description = get(&["og:description", "twitter:description", "description"]).and_then(|d| clip(d, 350));
    if title.is_none() && description.is_none() {
        return None;
    }
    let site_name = get(&["og:site_name"])
        .and_then(|s| clip(s, 128))
        .or_else(|| base.host_str().map(|h| h.trim_start_matches("www.").to_string()));
    let image = get(&[
        "og:image:secure_url",
        "og:image",
        "og:image:url",
        "twitter:image",
        "twitter:image:src",
    ])
    .and_then(|src| base.join(src.trim()).ok())
    .filter(allowed);
    Some(PageMeta {
        site_name,
        title,
        description,
        image,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn blocks_internal_addresses() {
        for ip in [
            "127.0.0.1",
            "10.0.0.5",
            "172.18.0.3",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "0.0.0.0",
            "::1",
            "fd00::1",
            "fe80::1",
            "::ffff:127.0.0.1",
        ] {
            assert!(!is_public(ip.parse().unwrap()), "{ip} should be blocked");
        }
        for ip in ["1.1.1.1", "140.82.112.3", "2606:4700:4700::1111"] {
            assert!(is_public(ip.parse().unwrap()), "{ip} should be allowed");
        }
    }

    #[test]
    fn only_public_http_urls_on_default_ports() {
        assert!(allowed(&url("https://example.com/page")));
        assert!(allowed(&url("http://example.com")));
        for bad in [
            "ftp://example.com",
            "file:///etc/passwd",
            "http://redis:6379",
            "http://minio:9000/glacier-uploads",
            "http://localhost/",
            "http://127.0.0.1/",
            "http://169.254.169.254/latest/meta-data",
            "https://example.com:8443/",
            "http://user:pass@example.com/",
            "http://[::1]/",
            "http://metadata.google.internal/",
        ] {
            assert!(!allowed(&url(bad)), "{bad} should be blocked");
        }
    }

    #[test]
    fn reads_open_graph_tags() {
        let html = r#"<html><head><title>Fallback</title>
            <meta property="og:title" content="Glacier &amp; friends">
            <meta property="og:site_name" content="Example">
            <meta name="description" content="  A   chat app.  ">
            <meta property="og:image" content="/img/card.png">
        </head></html>"#;
        let meta = parse(html, &url("https://example.com/a/b")).unwrap();
        assert_eq!(meta.title.as_deref(), Some("Glacier & friends"));
        assert_eq!(meta.site_name.as_deref(), Some("Example"));
        assert_eq!(meta.description.as_deref(), Some("A chat app."));
        assert_eq!(meta.image.unwrap().as_str(), "https://example.com/img/card.png");
    }

    #[test]
    fn falls_back_to_title_and_host() {
        let meta = parse("<title>Just a title</title>", &url("https://www.example.org/")).unwrap();
        assert_eq!(meta.title.as_deref(), Some("Just a title"));
        assert_eq!(meta.site_name.as_deref(), Some("example.org"));
        assert!(parse("<p>nothing</p>", &url("https://example.org/")).is_none());
    }

    #[test]
    fn empty_tags_fall_back() {
        let html = r#"<title>Rust Programming Language</title><meta property="og:title" content="">"#;
        let meta = parse(html, &url("https://www.rust-lang.org/")).unwrap();
        assert_eq!(meta.title.as_deref(), Some("Rust Programming Language"));
    }

    #[test]
    fn drops_images_on_internal_hosts() {
        let html =
            r#"<meta property="og:title" content="t"><meta property="og:image" content="http://10.0.0.1/x.png">"#;
        assert!(parse(html, &url("https://example.com/")).unwrap().image.is_none());
    }
}
