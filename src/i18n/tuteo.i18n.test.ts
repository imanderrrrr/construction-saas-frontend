// El español del panel va de «tú» (decisión del 2026-09-27): nunca de vos
// («Revisá», «tenés») ni de usted («Revise», «Pídale»). Esta prueba recorre
// todos los locales/es/*.json y falla si reaparece alguna forma de la lista.
// La lista es concreta a propósito: un patrón genérico (toda palabra aguda en
// -á/-é/-í) marcaría «más», «después», «podrá» o «terminé».

import { describe, expect, it } from 'vitest';

const files = import.meta.glob('./locales/es/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const strings = (value: unknown, path: string, out: [string, string][] = []): [string, string][] => {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) strings(v, path ? `${path}.${k}` : k, out);
  }
  return out;
};

const VOSEO = [
  // pronombre
  'vos',
  // imperativos
  'revisá', 'intentá', 'probá', 'elegí', 'escribí', 'volvé', 'hacé', 'tocá', 'esperá', 'agregá',
  'seleccioná', 'ingresá', 'pedí', 'recargá', 'guardá', 'cerrá', 'subí', 'usá', 'completá',
  'registrá', 'capturá', 'mirá', 'entrá', 'corregí', 'copiá', 'actualizá', 'contactá', 'adjuntá',
  'anulá', 'asigná', 'reasigná', 'confirmá', 'convertí', 'eliminá', 'empezá', 'especificá', 'marcá',
  'reportá', 'configurá', 'arrastrá', 'tené', 'poné', 'decí', 'borrá', 'bajá', 'apretá', 'abrí',
  'fijate', 'asegurate',
  // imperativos con pronombre
  'abrilo', 'cargala', 'convertila', 'corregilo', 'devolvele', 'devolvelo', 'generalo', 'pasale',
  'anulalos', 'borralos', 'agregalas', 'avisanos', 'contanos', 'crealo', 'escribile', 'escribinos',
  'pagalas', 'pedile', 'probalo', 'reportalo', 'revisalo', 'decile', 'enseñame',
  // presente
  'tenés', 'podés', 'querés', 'sabés', 'necesitás', 'debés', 'sos', 'bajás', 'copiás', 'escribís',
  'gastás', 'llevás', 'mandás', 'pasás', 'seguís', 'abrís', 'acabás', 'agregás', 'armás',
  'completás', 'confirmás', 'decidís', 'dibujás', 'elegís', 'emitís', 'emitás', 'ingresás', 'llamás',
  'manejás', 'pagás', 'preferís', 'terminás', 'esperás', 'cobrás', 'entrás', 'registrás',
  'capturás', 'marcás', 'cortás', 'apretás',
];

// Imperativos de usted. Solo con mayúscula inicial (arrancan la frase): en
// minúscula casi siempre son subjuntivo de tercera persona («que el trabajador
// registre», «hasta que se complete»), que está bien.
const USTED_START = [
  'Revise', 'Intente', 'Ingrese', 'Seleccione', 'Verifique', 'Espere', 'Asegúrese', 'Comuníquese',
  'Pídale', 'Escriba', 'Agregue', 'Complete', 'Asigne', 'Firme', 'Copie', 'Contacte', 'Use',
  'Utilice', 'Elija', 'Guarde', 'Recargue', 'Solicite', 'Introduzca', 'Consulte', 'Presione',
];
// Formas de usted que no se confunden con nada, en cualquier posición.
const USTED_ANY = ['usted', 'ustedes', 'asegúrese', 'comuníquese', 'pídale', 'mándelo', 'intente de nuevo', 'vuelva a intentar'];

// \b de JavaScript solo entiende ASCII: «revisá» nunca cerraría palabra. Se
// delimita con letras de cualquier alfabeto.
const word = (list: string[], flags: string) =>
  new RegExp(`(?<!\\p{L})(${list.join('|')})(?!\\p{L})`, flags);

const VOSEO_RE = word(VOSEO, 'iu');
const USTED_RE = new RegExp(`${word(USTED_START, 'u').source}|${word(USTED_ANY, 'iu').source}`, 'u');

describe('el español habla de tú', () => {
  it('encuentra los archivos en español', () => {
    expect(Object.keys(files).length).toBeGreaterThan(5);
  });

  it('ningún texto usa voseo', () => {
    const hits = Object.entries(files).flatMap(([file, json]) =>
      strings(json, '').filter(([, v]) => VOSEO_RE.test(v)).map(([k, v]) => `${file} ${k}: «${v.match(VOSEO_RE)?.[0]}» en "${v}"`));
    expect(hits).toEqual([]);
  });

  it('ningún texto habla de usted', () => {
    const hits = Object.entries(files).flatMap(([file, json]) =>
      strings(json, '').filter(([, v]) => USTED_RE.test(v)).map(([k, v]) => `${file} ${k}: «${v.match(USTED_RE)?.[0]}» en "${v}"`));
    expect(hits).toEqual([]);
  });

  it('la guarda sí detecta las formas prohibidas', () => {
    for (const s of ['Revisá tu conexión', 'Tenés 3 pendientes', 'lo hacemos por vos', 'Anulalos primero']) {
      expect(VOSEO_RE.test(s), s).toBe(true);
    }
    for (const s of ['Ingrese su correo', 'Pídale uno nuevo', 'Intente de nuevo.', 'mándelo usted']) {
      expect(USTED_RE.test(s), s).toBe(true);
    }
    for (const s of ['Revisa tu conexión', 'Tienes 3 pendientes', 'Ya no podrás', 'cuando el trabajador registre su salida', 'Puede que haya vencido', 'Necesita reparación', 'Sé el primero']) {
      expect(VOSEO_RE.test(s) || USTED_RE.test(s), s).toBe(false);
    }
  });
});
