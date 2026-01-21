export type CreateConnectionPayload =
    | ClientSecretCreatePayload
    | OAuthAuthorizationCodeCreatePayload;

export interface ClientSecretCreatePayload {
    method: "ClientSecret";
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    scope: string;
}

export interface OAuthAuthorizationCodeCreatePayload {
    method: "OAuth";
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    scope: string;
    authorizationCode: string;
    redirectUri: string;
}
