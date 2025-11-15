export interface QVResponse<T> {
    message: string;
    success: boolean;
    value: T;
}
