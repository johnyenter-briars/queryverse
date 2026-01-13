export type Value = 
    | number
    | string 
    | boolean
    | null

export type Attribute = string;

export interface Entity {
    attributes: Record<Attribute, Value>;
}
