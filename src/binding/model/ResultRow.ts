export type EntityReference = {
    id: string;
    logical_name: string;
    name?: string | null;
};

export type Value = number | string | boolean | null | EntityReference;//TODO: i think this needs to support float as well

export type Attribute = string;

export interface ResultRow {
    attributes: Record<Attribute, Value>;
}

