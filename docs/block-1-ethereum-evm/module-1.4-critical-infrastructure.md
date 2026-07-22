# Module 1.4 — Critical Infrastructure

← [Block 1 — Ethereum & the EVM](./README.md)

**Temas:** Oráculos & datos off-chain: Chainlink (price feeds, VRF, Automation, CCIP) · Indexing & queries: The Graph (subgraphs); Subsquid, Ponder · Storage & data availability: IPFS, Arweave · Librerías de contratos: OpenZeppelin Contracts · Block explorers como herramienta de debugging: Etherscan, Otterscan

**Recursos must:**
- [Chainlink Data Feeds — Getting Started](https://docs.chain.link/data-feeds/getting-started) — price feeds hands-on
- [The Graph: Index Custom Events](https://markaicode.com/the-graph-protocol-index-custom-events/) — guía paso a paso de subgraphs
- [IPFS for Developers](https://ipfs.tech/developers/) — content addressing, CIDs, pinning
- [How to Read Etherscan: A Complete Tutorial](https://evmtools.dev/guides/how-to-read-etherscan) — block explorer como herramienta de debugging

**Referencia (consultar cuando haga falta):**
- [Chainlink Documentation](https://docs.chain.link) — portal completo, para cuando integres oráculos
- [The Graph Documentation](https://thegraph.com/docs) — portal completo, para cuando construyas subgraphs

---

## Glosario nuevo

- **Oráculo**: un puente entre el mundo "de afuera" (precios, resultados deportivos, clima, APIs web2) y la blockchain. La EVM, por diseño, no puede hacer una llamada HTTP — es puramente determinista (Module 1.1) y solo conoce lo que ya está en el estado on-chain. Un oráculo trae ese dato de afuera y lo escribe on-chain para que los contratos lo lean.
- **Indexer**: un servicio que escucha eventos/logs (Module 1.1) en tiempo real y arma una base de datos consultable a partir de ellos, para no tener que "leer toda la blockchain" cada vez que tu frontend necesita una lista de datos.
- **Content addressing**: en vez de identificar un archivo por *dónde* está guardado (una URL, una ruta), se lo identifica por *qué es* — un hash de su contenido. Si el contenido cambia, el identificador cambia.
- **Data availability**: la garantía de que los datos necesarios para reconstruir/verificar un estado están realmente accesibles públicamente (no solo "confiá en que existen"). Concepto que va a ser central en Module 1.5 y en Block 2 (Arbitrum).

---

## 1. Oráculos & datos off-chain: Chainlink

**El problema que resuelven**: tu contrato de un protocolo de préstamos necesita saber "¿cuánto vale 1 ETH en USD ahora mismo?" para decidir si liquidar una posición. Pero la EVM no tiene forma de "salir a internet" a buscar ese dato — todo lo que un contrato puede leer tiene que estar ya escrito en el estado de la blockchain (Module 1.1). Los oráculos resuelven exactamente ese puente.

**Chainlink Data Feeds (price feeds)** es el caso de uso más común: una red de nodos operadores independientes reporta el precio de un activo, esos reportes se **agregan** (para que ningún nodo individual pueda manipular el resultado) y el resultado agregado queda disponible en una dirección on-chain fija que cualquier contrato puede leer. Desde tu contrato, el patrón es siempre el mismo:

```solidity
AggregatorV3Interface internal priceFeed;

constructor() {
    priceFeed = AggregatorV3Interface(0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43); // BTC/USD en Sepolia
}

function getLatestPrice() public view returns (int) {
    (, int price,,,) = priceFeed.latestRoundData();
    return price;
}
```

Esto es una **interface** (Module 1.2) — vos no implementás la lógica del oráculo, solo apuntás a la dirección ya deployada y llamás sus funciones.

Chainlink va más allá de precios: **VRF** (Verifiable Random Function) da aleatoriedad verificable on-chain (la EVM tampoco puede generar números random reales, porque tiene que ser determinista — Module 1.1), **Automation** dispara funciones de tu contrato automáticamente cuando se cumple una condición (recordá: "no hay concepto de cron en Ethereum", nadie ejecuta código solo, alguien tiene que mandar la transacción — Automation resuelve ese "alguien"), y **CCIP** es mensajería cross-chain (mover datos/tokens entre distintas blockchains de forma segura).

## 2. Indexing & queries: The Graph, Subsquid, Ponder

Ya vimos en Module 1.1 que los **eventos/logs** son la forma barata de que un contrato "avise" que algo pasó, pero que no son leíbles desde otro contrato — solo desde afuera. El problema práctico: si tu frontend necesita mostrar "todas las contribuciones que hizo esta dirección en el Community Vault", ¿cómo las conseguís sin escanear millones de bloques cada vez que alguien abre la página?

Ahí entran los **indexers**. **The Graph** es el más establecido: creás un **subgraph**, que son básicamente 3 archivos:

- `subgraph.yaml`: qué contrato y qué eventos específicos escuchar
- `schema.graphql`: cómo se van a guardar esos datos (las "entidades", ej. `Contribution { contributor, amount, timestamp }`)
- `mapping.ts`: el código (TypeScript, compilado a WASM) que corre cada vez que llega uno de esos eventos, y decide cómo transformarlo en una entidad guardada

Una vez deployado, tu frontend consulta ese subgraph con una query GraphQL normal — mucho más rápido y barato que pedirle directamente al nodo "dame todos los logs de este contrato desde el bloque 0". **Subsquid** y **Ponder** son alternativas más recientes con el mismo objetivo (indexar eventos on-chain en una base de datos consultable), con distintas filosofías de desarrollo — vale la pena saber que existen, pero The Graph sigue siendo el estándar de facto que vas a encontrar en la mayoría de proyectos.

## 3. Storage & data availability: IPFS, Arweave

El storage on-chain (Module 1.1, 1.2) es carísimo — cada byte que escribís ahí lo tienen que guardar y replicar miles de nodos para siempre. Para datos grandes (una imagen de NFT, un JSON de metadata, un documento) no tiene sentido guardarlos directamente en el contrato.

**IPFS (InterPlanetary File System)** resuelve esto con **content addressing**: en vez de un archivo vivir en una URL fija (que puede caerse, cambiar, desaparecer), se lo identifica por un **CID** — un hash de su propio contenido. Cualquier nodo de la red IPFS que tenga ese contenido lo puede servir, y como el identificador *es* un hash del contenido, es imposible que te den un archivo distinto al que pediste sin que el CID cambie (te avisa la manipulación gratis). El caso de uso típico: el `tokenURI` de un NFT (Module 1.2) apunta a un CID de IPFS en vez de una URL tradicional — así la metadata no depende de que la empresa que armó el proyecto siga pagando su hosting en 10 años.

Un detalle importante: IPFS por sí solo no garantiza que el contenido *persista* — si nadie lo "pinea" (se compromete a seguir sirviéndolo), puede volverse inaccesible. **Arweave** ataca ese problema distinto: es una red diseñada para pago único → almacenamiento permanente (el modelo económico incluye el costo de guardarlo "para siempre" desde el principio), útil cuando necesitás garantías más fuertes de persistencia que un simple pin de IPFS.

## 4. Librerías de contratos: OpenZeppelin Contracts

Ya la venís usando desde Module 1.2 (`ERC20`, `Ownable`, `ReentrancyGuard`) — vale la pena remarcar por qué importa como pieza de infraestructura: son contratos **auditados, estandarizados y usados por miles de proyectos**, lo que significa que los bugs comunes (los pitfalls de seguridad de 1.2) ya fueron encontrados y corregidos por la comunidad antes que vos los cometas. La norma no escrita del ecosistema es: **nunca reimplementes un ERC-20 o un patrón de access control desde cero** si podés heredar la versión de OpenZeppelin — el riesgo de introducir un bug sutil no vale la pena frente al beneficio de "reinventar la rueda".

## 5. Block explorers como herramienta de debugging: Etherscan, Otterscan

Un **block explorer** es una interfaz web que te deja ver todo lo que pasa en la blockchain sin correr tu propio nodo — pero para vos como developer, es sobre todo una herramienta de debugging.

Lo que podés sacar de ahí frente a una transacción:

- **Input Data (calldata)**: los primeros 4 bytes son el function selector (Module 1.2), el resto son los argumentos codificados. Si el contrato está verificado (código fuente subido y matcheado con el bytecode), Etherscan te lo decodifica directamente en texto legible; si no, tenés que decodificarlo vos con el selector.
- **Logs**: cada evento emitido, con su `topic 0` (el hash de la firma del evento, Module 1.1) y los argumentos indexados/no indexados — clave para reconstruir "qué pasó" en una transacción compleja.
- **Internal Txns**: las sub-llamadas que un contrato le hizo a otro *dentro* de la misma transacción (no son transacciones separadas, son parte de la ejecución) — esencial cuando tu contrato llama a otro contrato que llama a otro.
- **Estado de la tx y gas usado**: si falló, cuánto gas se consumió antes del revert (recordá de Module 1.1: se paga igual aunque falle).

**Otterscan** es una alternativa open-source pensada para correr contra tu propio nodo (en vez de depender del explorer centralizado de Etherscan) — útil si trabajás con una red donde Etherscan no tiene soporte, o si preferís no depender de un servicio de terceros para debuggear.

---

## Conexión con el ejercicio (Community Vault)

- La integración de dependencias de OpenZeppelin (`ERC20`, `Ownable`, `ReentrancyGuard`) es exactamente el patrón de la sección 4: heredar contratos auditados en vez de reescribirlos
- Como mejora opcional, el ejercicio sugiere desplegar en Arbitrum Sepolia y **verificar en el explorer** — ahí vas a usar directamente lo de la sección 5 para confirmar que tu contrato se ve y se comporta como esperás
- Si más adelante quisieras mostrar un historial de contribuciones en un frontend, ahí es donde entraría un subgraph (sección 2) — no es parte del ejercicio de esta semana, pero es el paso natural siguiente

Ver [Block 1](./README.md) para el detalle completo del ejercicio.

## Siguiente

→ [Module 1.5 — Why L2s Exist](./module-1.5-why-l2s-exist.md)
