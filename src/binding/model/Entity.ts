export type EntityReference = {
    id: string;
    logical_name: string;
    name?: string | null;
};

export type MoneyValue = {
    value: string | number;
};

export type OptionSetValue = {
    value: number;
    name?: string | null;
};

export type OptionSetValueCollection = {
    values: number[];
};

export type Value =
    | number
    | string
    | boolean
    | null
    | EntityReference
    | MoneyValue
    | OptionSetValue
    | OptionSetValueCollection;

export type Attribute = string;

export interface Entity {
    attributes: Record<Attribute, Value>;
}
