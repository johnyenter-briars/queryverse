export interface ConnectionFolder {
    id: string;
    name: string;
    parentFolderId?: string | null;
    color?: string | null;
    generatedOn: string;
}
