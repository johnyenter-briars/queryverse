export type Value = number | string | boolean | null;

export type Attribute = string;

export interface ResultRow {
    attributes: Record<Attribute, Value>;
}

