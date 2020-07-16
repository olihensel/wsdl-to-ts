export declare const TS_IMPORT_PATHS: {
    WSDL_CLIENT: string;
    WSDL_DECORATORS: string;
    WSDL_TYPES: string;
    CORE: string;
};
export default class Templates {
    static serviceHeaderTemplate(body: any): string;
    static serviceImportTemplate(body: any): string;
    static serviceMethodTemplate(body: any): string;
}
