export type CreateConnectionPayload =
    | ClientCredentialsCreatePayload
    | AuthorizationCodeCreatePayload;

export interface ClientCredentialsCreatePayload {
    method: "ClientCredentials";
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    scope: string;
    d365Url: string;
}

export interface AuthorizationCodeCreatePayload {
    method: "AuthorizationCode";
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    scope: string;
    authorizationCode: string;
    redirectUri: string;
    username: string;
    password: string;
    d365Url: string;
}
