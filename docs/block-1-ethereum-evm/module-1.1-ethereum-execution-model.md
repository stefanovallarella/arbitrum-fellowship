# Module 1.1 — Ethereum Execution Model

← [Block 1 — Ethereum & the EVM](./README.md)

**Temas:** state, blocks, finality · EOA vs contract accounts · transactions, signatures, nonce · EVM como máquina de estados determinista · gas model (EIP-1559) · events & logs

**Recursos must:**
- [Ethereum Developer Docs](https://ethereum.org/developers/docs) — Accounts, Transactions, Blocks, EVM
- [Ethereum Gas and Fees](https://ethereum.org/developers/docs/gas/)

**Nice to have (opcional, si hay tiempo):**
- [EVM: From Solidity to bytecode, memory and storage](https://www.youtube.com/watch?v=RxL_1AfV7N4) — video, 1h30, walkthrough técnico profundo (Ethereum Engineering Group)
- [A Dive Into EVM Architecture and Opcodes](https://www.quicknode.com/guides/ethereum-development/smart-contracts/a-dive-into-evm-architecture-and-opcodes) — artículo, stack/memory/storage/opcodes en más detalle (QuickNode)
- [evm.codes](https://www.evm.codes/) — playground interactivo para pisar bytecode opcode por opcode

---

## Glosario rápido (antes de arrancar)

Estos términos aparecen todo el tiempo y conviene tenerlos claros desde ya:

- **Blockchain**: una base de datos compartida entre miles de computadoras (*nodos*) en todo el mundo, donde nadie individualmente puede modificar el historial sin que el resto lo note. En vez de confiar en una empresa (como confiás en tu banco), confiás en que la mayoría de la red sigue las mismas reglas.
- **Nodo**: una computadora que corre el software de Ethereum, guarda una copia del estado/historial, y valida que todo lo nuevo que llega cumpla las reglas.
- **Hash**: el resultado de pasar cualquier dato por una función matemática (ej. Keccak-256) que devuelve siempre un valor de tamaño fijo, con dos propiedades clave: (1) mismo input, siempre mismo output, (2) cambiar un solo bit del input cambia el hash por completo e impredeciblemente. Se usa para "resumir" y verificar datos sin tener que compararlos entero por entero.
- **Clave privada / clave pública**: un par matemático generado juntos. Pensalo como un candado (clave pública, la podés compartir) y su llave (clave privada, nunca la compartís). Lo que firmás con tu clave privada, cualquiera puede verificar que lo firmaste vos usando tu clave pública, sin que vos reveles la privada.
- **Wei / Gwei / ETH**: unidades de la moneda nativa de Ethereum. 1 ETH equivale a 1,000,000,000,000,000,000 wei (10 a la 18). 1 gwei equivale a 1,000,000,000 wei (10 a la 9). El wei es la unidad más chica (como el centavo), el gwei se usa para hablar de precios de gas, el ETH es la unidad "grande" que ves en exchanges.

Con esto ya podés entender los cinco bloques de contenido de este módulo.

---

## 1. De ledger distribuido a "world computer": state, blocks, finality

**El problema que resuelve Ethereum**: necesitás que miles de computadoras que no se conocen ni confían entre sí, en distintos países, se pongan de acuerdo sobre quién tiene cuánto dinero y qué pasó, sin que haya un servidor central que arbitre. La solución es que todas ejecuten exactamente las mismas reglas y terminen, siempre, con exactamente el mismo resultado.

**Estado (state)**: es la "foto actual" de todo en la red, como una tabla enorme: qué balance tiene cada dirección, qué código tiene cada contrato desplegado, qué hay guardado en el storage de cada contrato. Ethereum no es solo un registro de transacciones (como una chequera de Bitcoin), es literalmente una computadora compartida que mantiene este estado y lo va actualizando, por eso se lo llama "world computer".

**Bloques**: el estado no cambia transacción por transacción de forma aislada, se agrupan en **bloques**. Cada bloque es un paquete de transacciones que, cuando se ejecutan en orden, transforman el estado de "antes" en "después". Cada bloque además apunta al bloque anterior (como un eslabón de cadena, de ahí "blockchain"), y lleva un `state_root`: un hash que resume todo el estado resultante. Cada nodo, de forma independiente, ejecuta las transacciones del bloque y recalcula ese hash; si a alguno le da distinto, sabe que algo está mal (o que hizo trampa).

**Finality (finalidad)**: en el sistema actual (proof-of-stake), hay validadores que pusieron 32 ETH como garantía ("stake") y van votando/atestiguando qué bloques son válidos. Un bloque pasa de propuesto, a "justified" (mayoría lo votó), a "finalized" (ya es prácticamente imposible revertirlo sin que los validadores pierdan su stake). Antes de llegar a "finalized", en teoría podría haber una reorganización de la cadena (un bloque "gana" y reemplaza a otro), por eso en exchanges te piden esperar varias confirmaciones antes de dar por segura una transacción grande.

## 2. EOA vs contract accounts; transacciones, firmas, nonce

Hay exactamente **dos tipos de cuenta** en Ethereum, y esta distinción es la base de todo lo que sigue en el fellowship:

- **EOA (Externally-Owned Account)**, "cuenta de una persona". Es lo que tenés vos cuando creás una wallet (MetaMask, etc.): un par de claves (privada/pública) generado matemáticamente. Con la clave privada podés *firmar* transacciones, es la única forma de "hacer algo" en Ethereum como humano. No tiene código propio.
- **Contract Account**, un contrato inteligente desplegado. Tiene código (el que escribiste en Solidity, compilado a bytecode) pero **no tiene clave privada**, nadie "controla" un contrato con una firma, solo reacciona cuando alguien (una EOA, u otro contrato) le manda una transacción o lo llama.

Regla de oro: **toda acción en Ethereum arranca siempre desde una EOA**, aunque después dispare una cadena larga de llamadas entre contratos.

Cada cuenta (de cualquier tipo) guarda 4 datos:

1. **nonce**: un contador. Para una EOA, cuántas transacciones mandó en total; para un contrato, cuántos contratos creó. Sirve para evitar que alguien capture una transacción tuya ya firmada y la reenvíe para que se ejecute dos veces (replay attack), cada transacción nueva tiene que usar el próximo nonce en orden, si no la red la rechaza.
2. **balance**: cuánto ETH tiene, en wei.
3. **codeHash**: vacío si es una EOA; el hash del bytecode del contrato si es un contract account.
4. **storageRoot**: solo relevante para contratos, el hash raíz de una estructura (Merkle Patricia Trie) que contiene todas las variables que el contrato tiene guardadas permanentemente.

**Una transacción** es el mensaje que una EOA firma y manda a la red para hacer algo (transferir ETH, llamar a un contrato). Sus partes principales: `from` (quién la manda), `to` (destino), `value` (cuánto ETH), `nonce`, `gasLimit` (cuánto gas estás dispuesto a gastar como máximo), `maxFeePerGas`/`maxPriorityFeePerGas` (cuánto pagás por ese gas, ver sección 4), `input data` (datos extra, ej. qué función de un contrato querés llamar y con qué argumentos), y la **firma**, generada con tu clave privada, prueba matemáticamente que la transacción salió de vos sin que reveles la clave.

Dato de color: hoy existen 5 "tipos" de transacción según cuándo se agregaron (legacy, EIP-2930 con access lists, EIP-1559 con base fee/priority fee, EIP-4844 para blobs de L2, EIP-7702 para account abstraction). No hace falta memorizarlos ahora, EIP-7702 va a reaparecer en Module 1.3 cuando veamos account abstraction.

## 3. La EVM como máquina de estados determinista

**Determinismo, explicado simple**: si le das la misma receta y los mismos ingredientes a mil cocineros distintos, todos tienen que sacar exactamente el mismo plato, ni un gramo de sal de diferencia. Eso es lo que exige la EVM: dado un estado inicial y un conjunto de transacciones, el resultado tiene que ser matemáticamente idéntico sin importar qué nodo lo calcule, en qué hardware, en qué país. Se escribe formalmente como Y(S, T) = S', donde S es el estado inicial, T las transacciones, y S' el estado resultante. Sin este determinismo, sería imposible que miles de nodos independientes se pusieran de acuerdo sobre el estado sin una autoridad central que decida "la verdad".

**Cómo ejecuta código la EVM**: cuando escribís un contrato en Solidity, el compilador lo traduce a **bytecode**, una secuencia de instrucciones muy básicas llamadas **opcodes** (sumar, comparar, guardar un valor, leer el balance de una dirección, etc.). La EVM va leyendo y ejecutando esos opcodes uno por uno, usando tres "espacios" de datos distintos, que conviene diferenciar bien porque tienen costos de gas muy distintos:

- **Stack**: una pila de hasta 1024 elementos (cada uno de 256 bits) donde la EVM hace sus cálculos intermedios, como la memoria de trabajo de una calculadora. Existe solo mientras se ejecuta esa instrucción.
- **Memory**: un espacio temporal más grande, tipo "bloc de notas", se usa durante la ejecución de una función, pero se borra por completo apenas termina la transacción. Barato en gas, pero no persiste.
- **Storage**: lo único que realmente **persiste en la blockchain** entre transacciones, son las variables de estado de tu contrato (ej. el `mapping` de contribuciones en el ejercicio Community Vault). Cada contrato tiene su propio storage, organizado como un Merkle Patricia Trie, y es lo más caro en gas de las tres porque cambiar esto es lo que efectivamente modifica el `state_root` global.
- **Transient storage** (opcodes `TSTORE`/`TLOAD`, agregado recientemente vía EIP-1153): un espacio intermedio, persiste durante toda una transacción (incluso entre llamadas internas a otros contratos) pero se borra al terminar la transacción, y es mucho más barato que el storage normal. Útil para casos como locks de reentrancy temporales.

Para bajar esto a tierra sin necesidad de escribir código todavía, `evm.codes` te deja cargar bytecode real y ver, paso a paso, cómo se llena el stack, qué queda en memory y qué termina en storage.

## 4. Gas model: pricing, gas limit, EIP-1559

**Por qué existe el gas**: cada operación que la EVM ejecuta (sumar, escribir en storage, llamar a otro contrato) le cuesta tiempo y recursos a cada uno de los miles de nodos que la re-ejecutan para validarla. Si fuera gratis, cualquiera podría escribir un bucle infinito y trabar la red entera. El gas es el "precio por unidad de trabajo computacional", pagás más cuanto más cómputo pedís.

**La fórmula, con ejemplo concreto:**

```
Costo total = Gas usado x (Base Fee + Priority Fee)
```

Tomemos una transferencia simple de ETH (que siempre cuesta 21,000 de gas) con Base Fee de 10 gwei y Priority Fee de 2 gwei:

```
21,000 x (10 + 2) = 252,000 gwei = 0.000252 ETH
```

De esos 252,000 gwei: 210,000 (la parte de Base Fee) se **queman**, desaparecen de circulación, no los recibe nadie, y 42,000 (la parte de Priority Fee) van al validador que incluyó tu transacción, como propina.

**Las piezas, una por una:**

- **Gas limit**: el máximo de gas que estás dispuesto a gastar en esa transacción. Una transferencia de ETH simple necesita 21,000; llamar a un contrato (como el `contribute()` del Community Vault) necesita más, según cuánto código ejecute. Si ponés un límite muy bajo, la transacción se queda sin gas a mitad de camino, se revierte (deshace todos los cambios) **pero igual pagás todo el gas que ya consumió** hasta el punto del fallo, por eso siempre conviene estimar con margen.
- **Base Fee**: no la elegís vos, la fija el protocolo automáticamente según qué tan ocupada está la red. Cada bloque tiene un "tamaño objetivo" (la mitad del gas limit del bloque); si el bloque anterior superó ese objetivo, la Base Fee del próximo bloque sube hasta un 12.5%; si estuvo por debajo, baja hasta 12.5%. Este ajuste automático es lo que introdujo **EIP-1559** (antes, todo el precio del gas era una subasta manual tipo "ofrezco tanto gwei", muy impredecible).
- **Priority Fee (tip)**: lo que vos decidís ofrecerle de propina al validador para que priorice tu transacción por sobre otras dentro del mismo bloque, útil cuando hay congestión y varias transacciones compiten por lugar.
- **maxFeePerGas**: el techo absoluto que autorizás pagar por unidad de gas (Base Fee + Priority Fee combinados). Si la Base Fee real termina siendo menor a lo que reservaste, te devuelven la diferencia, nunca pagás de más respecto a lo que realmente costó.

Este mecanismo, pagar por cada bloque de cómputo con precios que suben con la demanda, es exactamente el motivo por el que existen las Layer 2 como Arbitrum (Module 1.5): mueven la ejecución fuera de Ethereum L1 para no competir por ese espacio de bloque tan caro y congestionado.

## 5. Events, logs & el read-side model

Hasta acá vimos el "write-side": transacciones que cambian el estado, pasan por consenso, cuestan gas. Pero un contrato también necesita poder "avisar" que algo pasó, eso es el "read-side", y se resuelve con **eventos** y **logs**.

Cuando en Solidity escribís algo como `emit ContributionReceived(quien, cuanto)`, la EVM no lo guarda en el storage del contrato (sería carísimo), genera un **log**, que queda adjunto al recibo (receipt) de la transacción. Es mucho más barato en gas que storage, con la contrapartida de que **ningún otro contrato puede leer un log**, solo se puede leer "desde afuera" (un frontend, un explorador de bloques, un indexador).

Cada log tiene:
- **address**: qué contrato lo emitió.
- **topics**: hasta 4 valores de 32 bytes indexados, el primero siempre es el hash de la "firma" del evento (ej. keccak256 de "ContributionReceived(address,uint256)"), lo que permite filtrar rápido "dame todos los logs de este tipo de evento" sin tener que leer el `data` de cada uno.
- **data**: los argumentos que no se indexaron, codificados sin filtrar por ellos.

Esta separación (write-side caro y consensuado vs. read-side barato y solo-lectura-externa) es la base conceptual detrás de herramientas como **The Graph** (Module 1.4): en vez de que tu frontend tenga que re-ejecutar toda la blockchain para saber qué contribuciones hubo, un indexador escucha los logs en tiempo real y arma una base de datos consultable.

---

## Conexión con el ejercicio (Community Vault)

Todo lo de este módulo aparece directamente en el ejercicio de la semana:

- `msg.value` (cuánto ETH mandó quien llama la función) / `msg.sender` (quién la llama) → conceptos de transacciones (sección 2)
- Un `mapping` que trackea cuánto contribuyó cada dirección → storage persistente (sección 3)
- Los tres eventos obligatorios (`ContributionReceived`, `FundsWithdrawn`, `RefundClaimed`) → read-side model (sección 5)
- La lógica de `deadline` → timestamps de bloque, ligado a cómo avanza el estado bloque a bloque (sección 1)

Ver [Block 1](./README.md) para el detalle completo del ejercicio.

## Siguiente

→ [Module 1.2 — Solidity, ABI & Contract Lifecycle](./module-1.2-solidity-abi-contract-lifecycle.md)
