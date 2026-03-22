import { AuthConfig } from "./AuthConfig";

export type Connection = {
    id: string | null;
    name: string;
    parentFolderId?: string | null;
    auth: AuthConfig;
    generatedOn: string;
}
