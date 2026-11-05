// Simulacros de Firestore, Storage y correo para probar las funciones sin tocar Firebase real.
// Uso:  const {ESTADO, reiniciar, funciones} = require("./fakes");
const Module = require("node:module");
const {Readable} = require("node:stream");

const ESTADO = {};

function reiniciar() {
  ESTADO.docs = new Map(); // "coleccion/id" -> datos
  ESTADO.archivos = new Map(); // ruta -> {buf, contentType, metadata}
  ESTADO.correos = [];
  ESTADO.fallaCorreo = false;
  ESTADO.autoId = 0;
}

const MARCA_SERVIDOR = {__serverTimestamp: true};

class Marca {
  constructor(d) {
    this._d = d;
  }
  toDate() {
    return this._d;
  }
  toMillis() {
    return this._d.getTime();
  }
}

class Ref {
  constructor(clave) {
    this.clave = clave;
  }
  async get() {
    const d = ESTADO.docs.get(this.clave);
    return {exists: d !== undefined, id: this.clave.split("/")[1], data: () => (d === undefined ? undefined : d)};
  }
  async set(datos) {
    ESTADO.docs.set(this.clave, datos);
  }
  async update(cambios) {
    const actual = ESTADO.docs.get(this.clave);
    if (actual === undefined) throw new Error("NOT_FOUND: " + this.clave);
    ESTADO.docs.set(this.clave, {...actual, ...cambios});
  }
}

function coleccion(c) {
  return {
    doc: (id) => new Ref(`${c}/${id}`),
    async add(datos) {
      const id = `auto${++ESTADO.autoId}`;
      ESTADO.docs.set(`${c}/${id}`, datos);
      return {id};
    },
    orderBy(campo, sentido) {
      return {
        limit: (n) => ({
          async get() {
            const docs = [...ESTADO.docs.entries()]
                .filter(([k]) => k.startsWith(c + "/"))
                .map(([k, v]) => ({id: k.slice(c.length + 1), data: () => v}));
            const valor = (x) => {
              const f = x.data()[campo];
              return f && f.toMillis ? f.toMillis() : 0;
            };
            docs.sort((a, b) => (sentido === "desc" ? valor(b) - valor(a) : valor(a) - valor(b)));
            const corte = docs.slice(0, n);
            return {size: corte.length, docs: corte};
          },
        }),
      };
    },
  };
}

const dbFalsa = {
  collection: coleccion,
  async runTransaction(fn) {
    const escrituras = [];
    const tx = {
      get: (ref) => ref.get(),
      set: (ref, datos) => escrituras.push(() => ref.set(datos)),
      update: (ref, cambios) => escrituras.push(() => ref.update(cambios)),
    };
    const resultado = await fn(tx);
    for (const e of escrituras) await e();
    return resultado;
  },
};

class ArchivoFalso {
  constructor(ruta) {
    this.ruta = ruta;
  }
  async exists() {
    return [ESTADO.archivos.has(this.ruta)];
  }
  async getMetadata() {
    const a = ESTADO.archivos.get(this.ruta);
    return [{size: String(a.buf.length), contentType: a.contentType, metadata: a.metadata || {}}];
  }
  async download(op) {
    const a = ESTADO.archivos.get(this.ruta);
    return [op && op.end !== undefined ? a.buf.subarray(op.start, op.end + 1) : a.buf];
  }
  createReadStream() {
    return Readable.from([ESTADO.archivos.get(this.ruta).buf]);
  }
  async setMetadata(m) {
    const a = ESTADO.archivos.get(this.ruta);
    a.metadata = {...(a.metadata || {}), ...m.metadata};
  }
  async save(buf, op) {
    ESTADO.archivos.set(this.ruta, {buf, contentType: op.contentType, metadata: op.metadata.metadata});
  }
}

const bucketFalso = {name: "mesa-de-partes-5c6c2.firebasestorage.app", file: (r) => new ArchivoFalso(r)};

const simulacros = {
  "firebase-admin/app": {initializeApp: () => ({})},
  "firebase-admin/firestore": {
    getFirestore: () => dbFalsa,
    FieldValue: {serverTimestamp: () => MARCA_SERVIDOR},
    Timestamp: {fromDate: (d) => new Marca(d)},
  },
  "firebase-admin/storage": {getStorage: () => ({bucket: () => bucketFalso})},
  nodemailer: {
    createTransport: () => ({
      sendMail: async (m) => {
        if (ESTADO.fallaCorreo) throw new Error("SMTP caído");
        ESTADO.correos.push(m);
      },
    }),
  },
};

const cargarOriginal = Module._load;
Module._load = function(peticion, ...resto) {
  if (simulacros[peticion]) return simulacros[peticion];
  return cargarOriginal.call(this, peticion, ...resto);
};

Object.assign(process.env, {
  SMTP_USER: "demo@correo.com", SMTP_PASS: "x", MAIL_FROM: "demo@correo.com",
  MAIL_TO: "encargado@correo.com", GCLOUD_PROJECT: "mesa-de-partes-5c6c2",
});
delete process.env.FUNCIONARIOS;

reiniciar();
const funciones = require("../index.js");

module.exports = {ESTADO, reiniciar, funciones, Marca};
