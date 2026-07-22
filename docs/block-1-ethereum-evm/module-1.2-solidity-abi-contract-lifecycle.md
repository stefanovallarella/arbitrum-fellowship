# Module 1.2 — Solidity, ABI & Contract Lifecycle

← [Block 1 — Ethereum & the EVM](./README.md)

**Temas:** Solidity a grandes rasgos: estructura, visibilidad, modifiers, storage layout · ABI encoding, function selectors, calldata · Compilar, deployar, llamar, actualizar (proxy patterns) · Token standards: ERC-20, ERC-721, ERC-1155 · Pitfalls de seguridad: reentrancy, overflow, access control

**Recursos must:**
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts) — leer: guías de ERC-20, ERC-721 y la sección de Access Control
- [Cyfrin Updraft — Solidity Fundamentals](https://updraft.cyfrin.io/courses/solidity/simple-storage/introduction) — curso interactivo (Simple Storage, Storage Factory, Fund Me, AI Prompting). Es un curso en video/hands-on, no algo que se pueda "leer": conviene hacerlo directamente en la plataforma, con Remix IDE como entorno.

**Recursos de referencia (consultar cuando haga falta, no leer entero):**
- [Solidity Documentation](https://docs.soliditylang.org/) — referencia oficial del lenguaje

**Nice to have (opcional, si hay tiempo):**
- [ABI Encoding Series](https://www.decipherclub.com/why-learn-hard-solidity-things-abi-encoding-series-part-0/) — empezar en Part 0, mecánica de encode/decode en profundidad (Decipher Club)

---

## Glosario nuevo (además del de [Module 1.1](./module-1.1-ethereum-execution-model.md))

- **Constructor**: función especial que se ejecuta una única vez, en el momento del deploy. Sirve para inicializar el estado del contrato (ej. guardar quién lo desplegó). Después de correr, su código ni siquiera queda en el bytecode desplegado — es "de un solo uso".
- **Herencia (inheritance)**: un contrato puede heredar variables y funciones de otro (`contract Hijo is Padre`), igual que en programación orientada a objetos.
- **Interface**: la "forma" de un contrato (qué funciones tiene, sin implementación), útil para que un contrato llame a otro sin conocer su código completo — solo su interfaz.
- **Overflow / underflow**: cuando una operación aritmética se pasa del rango que puede representar el tipo de dato (ej. sumar 1 al máximo uint256 "da vuelta" a 0). Desde Solidity 0.8.0 esto revierte la transacción automáticamente, antes había que chequearlo a mano.
- **Reentrancy**: un tipo de ataque donde un contrato externo, en medio de recibir una llamada tuya, te vuelve a llamar antes de que termines de actualizar tu propio estado — explicado en detalle más abajo.
- **Proxy pattern**: técnica para poder "actualizar" la lógica de un contrato ya desplegado, ya que el bytecode de un contrato normal es inmutable una vez deployado.

---

## 1. Solidity a grandes rasgos: estructura, visibilidad, modifiers, storage layout

**Estructura de un contrato**: pensalo como una clase en programación orientada a objetos. Un contrato puede declarar: **state variables** (los datos que persisten, ver storage en [Module 1.1](./module-1.1-ethereum-execution-model.md)), **functions** (el código ejecutable), **modifiers** (chequeos reutilizables antes/después de una función), **events** (los logs que vimos en 1.1), **errors** (razones de revert tipadas, más baratas en gas que un string), **structs** (agrupar variables) y **enums** (un tipo con un set fijo de valores posibles).

**Visibilidad**: define quién puede ver o llamar algo. Pensalo como los niveles de acceso en un edificio de oficinas:

Para **variables de estado** (3 niveles):
- `public`: cualquiera puede leerla desde afuera (Solidity genera automáticamente una función "getter" — vos no la escribís, el compilador la crea). Nadie puede *escribirla* desde afuera aunque sea pública, solo tu propio código puede modificarla.
- `internal` (default): solo el contrato mismo y los que heredan de él.
- `private`: solo el contrato mismo, ni siquiera los que heredan pueden verla directamente.

⚠️ Importante: `private`/`internal` solo bloquea que *otros contratos* la lean por código — cualquiera puede seguir viendo el valor mirando la blockchain directamente (con un explorer o leyendo el storage raw). Nunca guardes secretos ahí pensando que están ocultos.

Para **funciones** (4 niveles, porque además de "quién puede verla" importa "cómo se la llama"):
- `external`: solo se puede llamar desde afuera (otra transacción o contrato), nunca internamente sin usar `this.funcion()`.
- `public`: se puede llamar tanto desde afuera como internamente.
- `internal`: solo desde el propio contrato o los que heredan de él.
- `private`: solo desde el propio contrato, ni siquiera los que heredan.

**Modifiers**: código reutilizable que se "inyecta" antes (y opcionalmente después) del cuerpo de una función. El símbolo `_;` marca dónde se inserta el cuerpo de la función real. El ejemplo clásico, que vas a usar directo en el ejercicio:

```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Only owner can call this function.");
    _;
}

function withdraw() public onlyOwner {
    // ...
}
```

Y el patrón que previene reentrancy (lo vas a necesitar para `withdraw()` y `refund()`):

```solidity
modifier noReentrancy() {
    require(!locked, "Reentrant call.");
    locked = true;
    _;
    locked = false;
}
```

**Storage layout** (a nivel intuitivo — no hace falta memorizar los detalles finos todavía): el storage de un contrato se organiza en "slots" de 32 bytes cada uno. Las variables de estado se van acomodando en orden de declaración, y si varias son chicas (ej. dos `uint16`), Solidity las **empaqueta** juntas en el mismo slot para ahorrar gas. Los `struct` y `array` siempre arrancan su propio slot nuevo. La razón por la que esto importa: escribir en un slot nuevo (que antes estaba en cero) cuesta bastante más gas que actualizar uno ya usado — es una de las primeras cosas que se optimizan en contratos que buscan ser gas-eficientes.

## 2. ABI encoding, function selectors, calldata

El **ABI (Application Binary Interface)** es el "contrato de interfaz" — la forma estándar en que algo de afuera (tu frontend, otro contrato, una wallet) sabe *cómo* llamar a las funciones de tu contrato y *cómo* interpretar lo que devuelve. Todo el input/output se codifica como bytes crudos siguiendo reglas fijas — nada de JSON ni texto legible, es lo que efectivamente viaja en el `input data` de la transacción que vimos en 1.1.

**Function selector**: cuando llamás a una función de un contrato, ¿cómo sabe la EVM cuál de todas tus funciones querés ejecutar? Los primeros **4 bytes** del `calldata` son el selector: los primeros 4 bytes del hash Keccak-256 de la "firma" de la función (nombre + tipos de parámetros, sin espacios, sin nombres de variables). Por ejemplo, para `transfer(address,uint256)`:

```
selector = primeros 4 bytes de keccak256("transfer(address,uint256)")
```

A partir del quinto byte en adelante viene el resto de los argumentos, codificados según su tipo. Esto es exactamente el mismo mecanismo que genera los `topics` de los eventos que vimos en 1.1 (el primer topic también es un hash de la firma) — es un patrón que se repite en todo Ethereum: "identificá algo por el hash de su firma".

**Calldata**: es donde vive físicamente esta información durante la ejecución — un área de solo lectura, más barata en gas que memory, pensada específicamente para los argumentos de una llamada externa. Por eso en Solidity vas a ver `function foo(uint[] calldata datos) external` en vez de `memory` cuando la función es `external` y no necesita modificar el array.

**Tipos estáticos vs dinámicos** (detalle solo para tener la intuición, no para memorizar la spec formal): tipos de tamaño fijo (`uint256`, `address`, `bool`) se codifican "in-place"; tipos de tamaño variable (`string`, `bytes`, arrays dinámicos) se codifican aparte, y en su lugar dejan un puntero (offset) hacia dónde está su contenido real. Esto es lo que hace posible mandar, por ejemplo, un array de longitud arbitraria en una sola llamada.

## 3. Compilar, deployar, llamar, actualizar (proxy patterns)

**El ciclo de vida completo de un contrato:**

1. **Escribís** el `.sol` con tu lógica.
2. **Compilás**: el compilador de Solidity genera dos cosas separadas — el **bytecode** (lo que se ejecuta en la EVM, visto en 1.1) y el **ABI** (el "manual de instrucciones" que describe cómo llamarlo, sección 2).
3. **Deployás**: mandás una transacción especial (sin `to`, con el bytecode como `data`) que crea la cuenta de contrato. El `constructor` corre una única vez en ese momento; su código *no* queda en el bytecode final desplegado — solo queda el código de las funciones que sí van a estar disponibles después.
4. **Llamás**: desde ahí en más, interactuás con el contrato ya desplegado mandando transacciones (si cambian estado) o `calls` de solo lectura (si son `view`/`pure`, no cuestan gas cuando se leen localmente).
5. **Actualizás** (opcional, y no trivial): acá está el problema — el bytecode de un contrato ya deployado es **inmutable**. Si encontrás un bug o querés agregar una función, no podés "editar" el contrato original.

**Proxy patterns**: la solución más común es separar el contrato en dos: un **proxy** (la dirección fija que todo el mundo usa, sin lógica de negocio) y una **implementación** (donde vive la lógica real). El proxy usa una instrucción de bajo nivel llamada `delegatecall` para ejecutar el código de la implementación *pero usando el storage del proxy* — como si "prestara" su cuerpo pero ejecutara el cerebro de otro contrato. Cuando querés actualizar, deployás una implementación nueva y le decís al proxy "de ahora en más, delegá a esta otra dirección" — la dirección pública para el usuario nunca cambia. Esto abre su propia categoría de riesgos (colisión de storage, quién tiene permiso de actualizar) — lo van a ver con más profundidad si el fellowship toca upgradeable contracts más adelante; por ahora alcanza con entender el problema que resuelve. *(Para el ejercicio de esta semana no hace falta: Community Vault es un contrato simple, no upgradeable.)*

## 4. Token standards: ERC-20, ERC-721, ERC-1155

Un "standard" acá significa: un set de funciones y eventos que, si tu contrato los implementa, cualquier wallet/exchange/dApp del ecosistema va a saber interactuar con él sin código especial para vos. Son interfaces (sección 1), no implementaciones — vos (o una librería como OpenZeppelin) proveés el código real.

**ERC-20 — tokens fungibles**: "fungible" quiere decir que cada unidad es exactamente igual a cualquier otra — como el dinero: un peso vale lo mismo que cualquier otro peso. Funciones clave: `transfer`, `balanceOf`, `approve`/`transferFrom` (para que un tercero mueva tokens en tu nombre). Un detalle importante: la EVM solo trabaja con enteros, no hay decimales nativos. `decimals` es un campo que le dice a las interfaces "dividí por 10^N para mostrar el valor humano" — pero *internamente* todo son enteros grandes. Con OpenZeppelin, crear un token ERC-20 es prácticamente heredar la clase y listo:

```solidity
contract GLDToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Gold", "GLD") {
        _mint(msg.sender, initialSupply);
    }
}
```

Esto es exactamente lo que vas a hacer en el ejercicio: `CommunityVault` va a heredar `ERC20` y actuar como el token de recibo al mismo tiempo que como el contrato de crowdfunding.

**ERC-721 — tokens no fungibles (NFTs)**: acá cada token es único e individualmente identificable (`tokenId`), no son intercambiables 1 a 1. No tiene `decimals` porque no se puede fraccionar. Funciones clave: `ownerOf(tokenId)`, `tokenURI(tokenId)` (apunta a metadata, generalmente JSON fuera de la cadena — IPFS es común acá, va a aparecer en Module 1.4).

**ERC-1155 — multi-token**: un solo contrato puede manejar muchos tipos de token a la vez (fungibles y no fungibles mezclados), con operaciones batch (transferir varios tipos en una sola transacción, más barato en gas que hacerlo uno por uno). Común en gaming/marketplaces con muchos ítems distintos. No está en los recursos must de este módulo — alcanza con saber que existe y para qué caso de uso conviene sobre ERC-20/721.

## 5. Pitfalls de seguridad comunes: reentrancy, overflow, access control

**Reentrancy** — el bug que causó el hackeo de "The DAO" (2016, ~$60M robados) y sigue siendo uno de los más comunes hoy. El problema: si tu función manda ETH a una dirección externa *antes* de terminar de actualizar tu propio estado, esa dirección externa (si es un contrato malicioso) puede aprovechar el control que tiene durante esa llamada para **volver a llamar tu función** — y como tu estado todavía no se actualizó, pasa de nuevo la misma validación y te vacía el contrato en un loop.

La defensa tiene dos capas, y las vas a usar juntas en el ejercicio:
1. **Checks-Effects-Interactions**: el orden importa. Primero validás condiciones (*checks*), después actualizás tu propio estado (*effects*), y **recién al final** hacés la llamada externa / mandás el ETH (*interactions*). Así, aunque te vuelvan a llamar en medio de la interacción, tu estado ya refleja que "esto ya se pagó" y la segunda llamada falla.
2. **ReentrancyGuard de OpenZeppelin**: una versión lista para usar del patrón `noReentrancy` de la sección 1 (con el `modifier` de la variable `locked`) — se la agregás a las funciones sensibles y listo.

**Overflow / underflow**: antes de Solidity 0.8.0, sumar 1 al valor máximo de un `uint256` lo hacía "dar la vuelta" silenciosamente a 0 — un bug catastrófico si no lo prevenías a mano (con librerías como SafeMath). Desde 0.8.0, el compilador agrega chequeos automáticos: cualquier operación que se pase de rango **revierte la transacción por default**. Por eso el ejercicio pide Solidity ≥0.8.19 — ya no necesitás SafeMath, viene gratis.

**Access control**: quién puede llamar qué. Dos patrones, según qué tan simple sea tu caso:
- **Ownable** (OpenZeppelin): un único dueño, controlado con el modifier `onlyOwner`. Perfecto para contratos simples con un solo admin — como `withdraw()` en Community Vault, que solo el owner puede ejecutar.
- **AccessControl** (OpenZeppelin): control basado en roles (`MINTER_ROLE`, `PAUSER_ROLE`, etc.) cuando necesitás varios niveles de permiso distintos, no solo "dueño sí/no" — por ejemplo, un rol que puede pausar el contrato pero no puede mintear tokens. Aplica el principio de menor privilegio: cada cuenta tiene exactamente el permiso que necesita, ni más.

---

## Conexión con el ejercicio (Community Vault)

Este módulo es el que más se traduce 1 a 1 al código del ejercicio:

- `CommunityVault is ERC20, Ownable, ReentrancyGuard` → herencia múltiple (sección 1) + los tres imports de OpenZeppelin de las secciones 4 y 5
- `contribute()` es `payable` → visibilidad y modifiers (sección 1)
- El token de recibo (1 wei = 1 token) → implementación mínima de ERC-20 (sección 4)
- `withdraw()` con `onlyOwner` → access control con Ownable (sección 5)
- `refund()` con patrón pull + checks-effects-interactions + `ReentrancyGuard` → defensa contra reentrancy (sección 5)
- Solidity ≥0.8.19 → overflow/underflow ya cubierto por el compilador (sección 5)

Ver [Block 1](./README.md) para el detalle completo del ejercicio.

## Siguiente

→ [Module 1.3 — Dev Environment & Tooling](./module-1.3-dev-environment-tooling.md)
