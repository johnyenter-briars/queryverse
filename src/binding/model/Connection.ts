export type Connection = ClientCredentialsConnection | AuthorizationCodeConnection

export type ConnectionMethod = 'ClientCredentials' | 'AuthorizationCode'

export interface ClientCredentialsConnection {
    method: ConnectionMethod;
    id: string | null;
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    scope: string;
    d365Url: string;
}

export interface AuthorizationCodeConnection {
    method: ConnectionMethod;
    id: string | null;
    name: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string; 
    d365Url: string;
}
