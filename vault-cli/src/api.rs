use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct SaltResponse {
    salt: String,
}

#[derive(Serialize)]
struct RegisterRequest<'a> {
    username: &'a str,
    salt: String,
    auth_key: String,
}

#[derive(Serialize)]
struct LoginRequest<'a> {
    username: &'a str,
    auth_key: String,
}

#[derive(Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_at: String,
}

#[derive(Serialize, Clone)]
pub struct ItemPayload {
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Deserialize, Clone)]
pub struct ItemResponse {
    pub id: String,
    pub nonce: String,
    pub ciphertext: String,
}

pub struct Api {
    client: reqwest::Client,
    server_url: String,
}

impl Api {
    pub fn new(server_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            server_url,
        }
    }

    async fn check(resp: reqwest::Response) -> Result<reqwest::Response> {
        if resp.status().is_success() {
            Ok(resp)
        } else {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            bail!("server returned {status}: {body}");
        }
    }

    pub async fn get_salt(&self, username: &str) -> Result<String> {
        let url = format!("{}/users/{}/salt", self.server_url, urlencoding::encode(username));
        let resp = self.client.get(&url).send().await.context("contacting server")?;
        let resp = Self::check(resp).await?;
        Ok(resp.json::<SaltResponse>().await?.salt)
    }

    pub async fn register(&self, username: &str, salt: &str, auth_key: &str) -> Result<()> {
        let url = format!("{}/register", self.server_url);
        let resp = self
            .client
            .post(&url)
            .json(&RegisterRequest {
                username,
                salt: salt.to_string(),
                auth_key: auth_key.to_string(),
            })
            .send()
            .await
            .context("contacting server")?;
        Self::check(resp).await?;
        Ok(())
    }

    pub async fn login(&self, username: &str, auth_key: &str) -> Result<LoginResponse> {
        let url = format!("{}/login", self.server_url);
        let resp = self
            .client
            .post(&url)
            .json(&LoginRequest {
                username,
                auth_key: auth_key.to_string(),
            })
            .send()
            .await
            .context("contacting server")?;
        let resp = Self::check(resp).await?;
        Ok(resp.json().await?)
    }

    pub async fn logout(&self, token: &str) -> Result<()> {
        let url = format!("{}/logout", self.server_url);
        let resp = self
            .client
            .post(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("contacting server")?;
        Self::check(resp).await?;
        Ok(())
    }

    pub async fn list_items(&self, token: &str) -> Result<Vec<ItemResponse>> {
        let url = format!("{}/items", self.server_url);
        let resp = self
            .client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("contacting server")?;
        let resp = Self::check(resp).await?;
        Ok(resp.json().await?)
    }

    pub async fn create_item(&self, token: &str, payload: &ItemPayload) -> Result<ItemResponse> {
        let url = format!("{}/items", self.server_url);
        let resp = self
            .client
            .post(&url)
            .bearer_auth(token)
            .json(payload)
            .send()
            .await
            .context("contacting server")?;
        let resp = Self::check(resp).await?;
        Ok(resp.json().await?)
    }

    pub async fn get_item(&self, token: &str, id: &str) -> Result<ItemResponse> {
        let url = format!("{}/items/{}", self.server_url, id);
        let resp = self
            .client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("contacting server")?;
        let resp = Self::check(resp).await?;
        Ok(resp.json().await?)
    }

    pub async fn update_item(&self, token: &str, id: &str, payload: &ItemPayload) -> Result<ItemResponse> {
        let url = format!("{}/items/{}", self.server_url, id);
        let resp = self
            .client
            .put(&url)
            .bearer_auth(token)
            .json(payload)
            .send()
            .await
            .context("contacting server")?;
        let resp = Self::check(resp).await?;
        Ok(resp.json().await?)
    }

    pub async fn delete_item(&self, token: &str, id: &str) -> Result<()> {
        let url = format!("{}/items/{}", self.server_url, id);
        let resp = self
            .client
            .delete(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("contacting server")?;
        Self::check(resp).await?;
        Ok(())
    }
}
