export type Value = number | string | boolean | null;//TODO: i think this needs to support float as well

export type Attribute = string;

export interface ResultRow {
    attributes: Record<Attribute, Value>;
}

