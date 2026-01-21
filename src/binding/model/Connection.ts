export type Connection = ClientSecretConnection | OAuthConnection

export type ConnectionMethod = 'ClientSecret' | 'OAuth'

export interface ClientSecretConnection {
    method: ConnectionMethod;
    id: string | null;
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    scope: string;
}

export interface OAuthConnection {
    method: ConnectionMethod;
    id: string | null;
    name: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string; 
}
