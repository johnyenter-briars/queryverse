import { AuthConfig } from "./AuthConfig";

export type Connection = {
    id: string | null;
    name: string;
    auth: AuthConfig;
    generatedOn: string;
}
