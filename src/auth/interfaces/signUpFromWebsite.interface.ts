export interface SignUpFromWebsiteInterface {
    tipoRegistro: string;
    telefono: string;
    nombre: string;
    apellido: string;
    profesion: string;
    cedula: string;
    nit: string;
    biografia: string;
    servicios: string[];
    files: {
        fotoPerfil?: Express.Multer.File[];
        fotoCedula?: Express.Multer.File[];
        camaraComercio?: Express.Multer.File[];
    }
}

export interface SignUpFromWebsiteResponseInterface {
    message: string;
    status: number;
    data: any;
}
