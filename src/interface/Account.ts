export interface Account {
    email: string;
    password: string;
    proxy: AccountProxy;
    set: string;
}

export interface AccountProxy {
    proxyAxios: boolean;
    url: string;
    port: number;
    password: string;
    username: string;
}