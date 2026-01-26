use std::{
    collections::HashMap,
    time::{SystemTime, UNIX_EPOCH},
};

use reqwest::Client;
use serde_json::Value;

pub struct TokenExchange {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
}

pub struct ClientCredentialsToken {
    pub access_token: String,
    pub expires_at: u64,
}

pub async fn fetch_client_credentials_token(
    client_id: &str,
    client_secret: &str,
    tenant_id: &str,
    scope: &str,
) -> Result<String, String> {
    let token = fetch_client_credentials_token_with_expiry(
        client_id,
        client_secret,
        tenant_id,
        scope,
    )
    .await?;
    Ok(token.access_token)
}

pub async fn fetch_client_credentials_token_with_expiry(
    client_id: &str,
    client_secret: &str,
    tenant_id: &str,
    scope: &str,
) -> Result<ClientCredentialsToken, String> {
    let client = Client::new();
    let token_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );

    let mut params = HashMap::new();
    params.insert("client_id", client_id);
    params.insert("client_secret", client_secret);
    params.insert("scope", scope);
    params.insert("grant_type", "client_credentials");

    let resp = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(body);
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;

    let access_token = json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("No access_token in response")?;
    let expires_in = json
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .ok_or("No expires_in in response")?;

    if access_token.trim().is_empty() {
        return Err("Access token was empty".to_string());
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    Ok(ClientCredentialsToken {
        access_token: access_token.to_string(),
        expires_at: now + expires_in,
    })
}

pub async fn validate_client_credentials(
    client_id: &str,
    client_secret: &str,
    tenant_id: &str,
    scope: &str,
) -> Result<(), String> {
    fetch_client_credentials_token(client_id, client_secret, tenant_id, scope).await?;
    Ok(())
}

pub async fn exchange_authorization_code(
    client_id: &str,
    client_secret: &str,
    tenant_id: &str,
    scope: &str,
    authorization_code: &str,
    redirect_uri: &str,
    username: &str,
    password: &str,
) -> Result<TokenExchange, String> {
    let client = Client::new();
    let token_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );

    let mut params = HashMap::new();
    params.insert("client_id", client_id);
    params.insert("client_secret", client_secret);
    params.insert("scope", scope);
    if authorization_code.trim().is_empty() {
        params.insert("grant_type", "password");
        params.insert("username", username);
        params.insert("password", password);
    } else {
        params.insert("grant_type", "authorization_code");
        params.insert("code", authorization_code);
        params.insert("redirect_uri", redirect_uri);
    }

    let resp = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(body);
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;

    let access_token = json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("No access_token in response")?
        .to_string();

    let refresh_token = json
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .ok_or("No refresh_token in response")?
        .to_string();

    let expires_in = json
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .ok_or("No expires_in in response")?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let expires_at = now + expires_in;

    Ok(TokenExchange {
        access_token,
        refresh_token,
        expires_at,
    })
}

pub async fn refresh_authorization_token(
    client_id: &str,
    client_secret: &str,
    tenant_id: &str,
    scope: &str,
    refresh_token: &str,
) -> Result<TokenExchange, String> {
    todo!("#11");
    let client = Client::new();
    let token_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );

    let mut params = HashMap::new();
    params.insert("client_id", client_id);
    params.insert("client_secret", client_secret);
    params.insert("scope", scope);
    params.insert("grant_type", "refresh_token");
    params.insert("refresh_token", refresh_token);

    let resp = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(body);
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;

    let access_token = json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("No access_token in response")?
        .to_string();

    let refreshed_token = json
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or(refresh_token)
        .to_string();

    let expires_in = json
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .ok_or("No expires_in in response")?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    Ok(TokenExchange {
        access_token,
        refresh_token: refreshed_token,
        expires_at: now + expires_in,
    })
}
