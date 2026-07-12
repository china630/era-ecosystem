
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model CalendarDay
 * Production calendar (hub-owned; not in finance core).
 */
export type CalendarDay = $Result.DefaultSelection<Prisma.$CalendarDayPayload>
/**
 * Model CbarOfficialRate
 * 
 */
export type CbarOfficialRate = $Result.DefaultSelection<Prisma.$CbarOfficialRatePayload>
/**
 * Model GlobalCompanyDirectory
 * 
 */
export type GlobalCompanyDirectory = $Result.DefaultSelection<Prisma.$GlobalCompanyDirectoryPayload>
/**
 * Model BankGlossary
 * 
 */
export type BankGlossary = $Result.DefaultSelection<Prisma.$BankGlossaryPayload>
/**
 * Model BankBranch
 * 
 */
export type BankBranch = $Result.DefaultSelection<Prisma.$BankBranchPayload>
/**
 * Model CustomsTariffRate
 * 
 */
export type CustomsTariffRate = $Result.DefaultSelection<Prisma.$CustomsTariffRatePayload>
/**
 * Model UnitOfMeasure
 * 
 */
export type UnitOfMeasure = $Result.DefaultSelection<Prisma.$UnitOfMeasurePayload>
/**
 * Model Currency
 * ISO 4217 currency catalog (SoR). Distinct from CbarOfficialRate (FX rates on a date).
 */
export type Currency = $Result.DefaultSelection<Prisma.$CurrencyPayload>
/**
 * Model Country
 * 
 */
export type Country = $Result.DefaultSelection<Prisma.$CountryPayload>
/**
 * Model City
 * 
 */
export type City = $Result.DefaultSelection<Prisma.$CityPayload>
/**
 * Model TaxRate
 * 
 */
export type TaxRate = $Result.DefaultSelection<Prisma.$TaxRatePayload>

/**
 * Enums
 */
export namespace $Enums {
  export const CbarRateStatus: {
  PRELIMINARY: 'PRELIMINARY',
  FINAL: 'FINAL'
};

export type CbarRateStatus = (typeof CbarRateStatus)[keyof typeof CbarRateStatus]


export const CounterpartyLegalForm: {
  LLC: 'LLC',
  JSC: 'JSC',
  INDIVIDUAL_ENTREPRENEUR: 'INDIVIDUAL_ENTREPRENEUR',
  BRANCH: 'BRANCH',
  REPRESENTATION: 'REPRESENTATION',
  OTHER: 'OTHER'
};

export type CounterpartyLegalForm = (typeof CounterpartyLegalForm)[keyof typeof CounterpartyLegalForm]


export const UnitOfMeasureKind: {
  PIECE: 'PIECE',
  WEIGHT: 'WEIGHT',
  LENGTH: 'LENGTH',
  VOLUME: 'VOLUME',
  AREA: 'AREA',
  TIME: 'TIME',
  OTHER: 'OTHER'
};

export type UnitOfMeasureKind = (typeof UnitOfMeasureKind)[keyof typeof UnitOfMeasureKind]


export const TaxRateKind: {
  VAT: 'VAT',
  EXCISE: 'EXCISE',
  SIMPLIFIED: 'SIMPLIFIED',
  OTHER: 'OTHER'
};

export type TaxRateKind = (typeof TaxRateKind)[keyof typeof TaxRateKind]

}

export type CbarRateStatus = $Enums.CbarRateStatus

export const CbarRateStatus: typeof $Enums.CbarRateStatus

export type CounterpartyLegalForm = $Enums.CounterpartyLegalForm

export const CounterpartyLegalForm: typeof $Enums.CounterpartyLegalForm

export type UnitOfMeasureKind = $Enums.UnitOfMeasureKind

export const UnitOfMeasureKind: typeof $Enums.UnitOfMeasureKind

export type TaxRateKind = $Enums.TaxRateKind

export const TaxRateKind: typeof $Enums.TaxRateKind

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more CalendarDays
 * const calendarDays = await prisma.calendarDay.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more CalendarDays
   * const calendarDays = await prisma.calendarDay.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.calendarDay`: Exposes CRUD operations for the **CalendarDay** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CalendarDays
    * const calendarDays = await prisma.calendarDay.findMany()
    * ```
    */
  get calendarDay(): Prisma.CalendarDayDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.cbarOfficialRate`: Exposes CRUD operations for the **CbarOfficialRate** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CbarOfficialRates
    * const cbarOfficialRates = await prisma.cbarOfficialRate.findMany()
    * ```
    */
  get cbarOfficialRate(): Prisma.CbarOfficialRateDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.globalCompanyDirectory`: Exposes CRUD operations for the **GlobalCompanyDirectory** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more GlobalCompanyDirectories
    * const globalCompanyDirectories = await prisma.globalCompanyDirectory.findMany()
    * ```
    */
  get globalCompanyDirectory(): Prisma.GlobalCompanyDirectoryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.bankGlossary`: Exposes CRUD operations for the **BankGlossary** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more BankGlossaries
    * const bankGlossaries = await prisma.bankGlossary.findMany()
    * ```
    */
  get bankGlossary(): Prisma.BankGlossaryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.bankBranch`: Exposes CRUD operations for the **BankBranch** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more BankBranches
    * const bankBranches = await prisma.bankBranch.findMany()
    * ```
    */
  get bankBranch(): Prisma.BankBranchDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.customsTariffRate`: Exposes CRUD operations for the **CustomsTariffRate** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CustomsTariffRates
    * const customsTariffRates = await prisma.customsTariffRate.findMany()
    * ```
    */
  get customsTariffRate(): Prisma.CustomsTariffRateDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.unitOfMeasure`: Exposes CRUD operations for the **UnitOfMeasure** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UnitOfMeasures
    * const unitOfMeasures = await prisma.unitOfMeasure.findMany()
    * ```
    */
  get unitOfMeasure(): Prisma.UnitOfMeasureDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.currency`: Exposes CRUD operations for the **Currency** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Currencies
    * const currencies = await prisma.currency.findMany()
    * ```
    */
  get currency(): Prisma.CurrencyDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.country`: Exposes CRUD operations for the **Country** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Countries
    * const countries = await prisma.country.findMany()
    * ```
    */
  get country(): Prisma.CountryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.city`: Exposes CRUD operations for the **City** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Cities
    * const cities = await prisma.city.findMany()
    * ```
    */
  get city(): Prisma.CityDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.taxRate`: Exposes CRUD operations for the **TaxRate** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TaxRates
    * const taxRates = await prisma.taxRate.findMany()
    * ```
    */
  get taxRate(): Prisma.TaxRateDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.8.0
   * Query Engine version: 3c6e192761c0362d496ed980de936e2f3cebcd3a
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    CalendarDay: 'CalendarDay',
    CbarOfficialRate: 'CbarOfficialRate',
    GlobalCompanyDirectory: 'GlobalCompanyDirectory',
    BankGlossary: 'BankGlossary',
    BankBranch: 'BankBranch',
    CustomsTariffRate: 'CustomsTariffRate',
    UnitOfMeasure: 'UnitOfMeasure',
    Currency: 'Currency',
    Country: 'Country',
    City: 'City',
    TaxRate: 'TaxRate'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "calendarDay" | "cbarOfficialRate" | "globalCompanyDirectory" | "bankGlossary" | "bankBranch" | "customsTariffRate" | "unitOfMeasure" | "currency" | "country" | "city" | "taxRate"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      CalendarDay: {
        payload: Prisma.$CalendarDayPayload<ExtArgs>
        fields: Prisma.CalendarDayFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CalendarDayFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CalendarDayFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>
          }
          findFirst: {
            args: Prisma.CalendarDayFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CalendarDayFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>
          }
          findMany: {
            args: Prisma.CalendarDayFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>[]
          }
          create: {
            args: Prisma.CalendarDayCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>
          }
          createMany: {
            args: Prisma.CalendarDayCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CalendarDayCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>[]
          }
          delete: {
            args: Prisma.CalendarDayDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>
          }
          update: {
            args: Prisma.CalendarDayUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>
          }
          deleteMany: {
            args: Prisma.CalendarDayDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CalendarDayUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CalendarDayUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>[]
          }
          upsert: {
            args: Prisma.CalendarDayUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarDayPayload>
          }
          aggregate: {
            args: Prisma.CalendarDayAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCalendarDay>
          }
          groupBy: {
            args: Prisma.CalendarDayGroupByArgs<ExtArgs>
            result: $Utils.Optional<CalendarDayGroupByOutputType>[]
          }
          count: {
            args: Prisma.CalendarDayCountArgs<ExtArgs>
            result: $Utils.Optional<CalendarDayCountAggregateOutputType> | number
          }
        }
      }
      CbarOfficialRate: {
        payload: Prisma.$CbarOfficialRatePayload<ExtArgs>
        fields: Prisma.CbarOfficialRateFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CbarOfficialRateFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CbarOfficialRateFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>
          }
          findFirst: {
            args: Prisma.CbarOfficialRateFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CbarOfficialRateFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>
          }
          findMany: {
            args: Prisma.CbarOfficialRateFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>[]
          }
          create: {
            args: Prisma.CbarOfficialRateCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>
          }
          createMany: {
            args: Prisma.CbarOfficialRateCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CbarOfficialRateCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>[]
          }
          delete: {
            args: Prisma.CbarOfficialRateDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>
          }
          update: {
            args: Prisma.CbarOfficialRateUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>
          }
          deleteMany: {
            args: Prisma.CbarOfficialRateDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CbarOfficialRateUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CbarOfficialRateUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>[]
          }
          upsert: {
            args: Prisma.CbarOfficialRateUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CbarOfficialRatePayload>
          }
          aggregate: {
            args: Prisma.CbarOfficialRateAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCbarOfficialRate>
          }
          groupBy: {
            args: Prisma.CbarOfficialRateGroupByArgs<ExtArgs>
            result: $Utils.Optional<CbarOfficialRateGroupByOutputType>[]
          }
          count: {
            args: Prisma.CbarOfficialRateCountArgs<ExtArgs>
            result: $Utils.Optional<CbarOfficialRateCountAggregateOutputType> | number
          }
        }
      }
      GlobalCompanyDirectory: {
        payload: Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>
        fields: Prisma.GlobalCompanyDirectoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.GlobalCompanyDirectoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.GlobalCompanyDirectoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>
          }
          findFirst: {
            args: Prisma.GlobalCompanyDirectoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.GlobalCompanyDirectoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>
          }
          findMany: {
            args: Prisma.GlobalCompanyDirectoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>[]
          }
          create: {
            args: Prisma.GlobalCompanyDirectoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>
          }
          createMany: {
            args: Prisma.GlobalCompanyDirectoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.GlobalCompanyDirectoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>[]
          }
          delete: {
            args: Prisma.GlobalCompanyDirectoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>
          }
          update: {
            args: Prisma.GlobalCompanyDirectoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>
          }
          deleteMany: {
            args: Prisma.GlobalCompanyDirectoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.GlobalCompanyDirectoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.GlobalCompanyDirectoryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>[]
          }
          upsert: {
            args: Prisma.GlobalCompanyDirectoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalCompanyDirectoryPayload>
          }
          aggregate: {
            args: Prisma.GlobalCompanyDirectoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGlobalCompanyDirectory>
          }
          groupBy: {
            args: Prisma.GlobalCompanyDirectoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<GlobalCompanyDirectoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.GlobalCompanyDirectoryCountArgs<ExtArgs>
            result: $Utils.Optional<GlobalCompanyDirectoryCountAggregateOutputType> | number
          }
        }
      }
      BankGlossary: {
        payload: Prisma.$BankGlossaryPayload<ExtArgs>
        fields: Prisma.BankGlossaryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.BankGlossaryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.BankGlossaryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>
          }
          findFirst: {
            args: Prisma.BankGlossaryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.BankGlossaryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>
          }
          findMany: {
            args: Prisma.BankGlossaryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>[]
          }
          create: {
            args: Prisma.BankGlossaryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>
          }
          createMany: {
            args: Prisma.BankGlossaryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.BankGlossaryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>[]
          }
          delete: {
            args: Prisma.BankGlossaryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>
          }
          update: {
            args: Prisma.BankGlossaryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>
          }
          deleteMany: {
            args: Prisma.BankGlossaryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.BankGlossaryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.BankGlossaryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>[]
          }
          upsert: {
            args: Prisma.BankGlossaryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankGlossaryPayload>
          }
          aggregate: {
            args: Prisma.BankGlossaryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateBankGlossary>
          }
          groupBy: {
            args: Prisma.BankGlossaryGroupByArgs<ExtArgs>
            result: $Utils.Optional<BankGlossaryGroupByOutputType>[]
          }
          count: {
            args: Prisma.BankGlossaryCountArgs<ExtArgs>
            result: $Utils.Optional<BankGlossaryCountAggregateOutputType> | number
          }
        }
      }
      BankBranch: {
        payload: Prisma.$BankBranchPayload<ExtArgs>
        fields: Prisma.BankBranchFieldRefs
        operations: {
          findUnique: {
            args: Prisma.BankBranchFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.BankBranchFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>
          }
          findFirst: {
            args: Prisma.BankBranchFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.BankBranchFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>
          }
          findMany: {
            args: Prisma.BankBranchFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>[]
          }
          create: {
            args: Prisma.BankBranchCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>
          }
          createMany: {
            args: Prisma.BankBranchCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.BankBranchCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>[]
          }
          delete: {
            args: Prisma.BankBranchDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>
          }
          update: {
            args: Prisma.BankBranchUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>
          }
          deleteMany: {
            args: Prisma.BankBranchDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.BankBranchUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.BankBranchUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>[]
          }
          upsert: {
            args: Prisma.BankBranchUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BankBranchPayload>
          }
          aggregate: {
            args: Prisma.BankBranchAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateBankBranch>
          }
          groupBy: {
            args: Prisma.BankBranchGroupByArgs<ExtArgs>
            result: $Utils.Optional<BankBranchGroupByOutputType>[]
          }
          count: {
            args: Prisma.BankBranchCountArgs<ExtArgs>
            result: $Utils.Optional<BankBranchCountAggregateOutputType> | number
          }
        }
      }
      CustomsTariffRate: {
        payload: Prisma.$CustomsTariffRatePayload<ExtArgs>
        fields: Prisma.CustomsTariffRateFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CustomsTariffRateFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CustomsTariffRateFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>
          }
          findFirst: {
            args: Prisma.CustomsTariffRateFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CustomsTariffRateFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>
          }
          findMany: {
            args: Prisma.CustomsTariffRateFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>[]
          }
          create: {
            args: Prisma.CustomsTariffRateCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>
          }
          createMany: {
            args: Prisma.CustomsTariffRateCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CustomsTariffRateCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>[]
          }
          delete: {
            args: Prisma.CustomsTariffRateDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>
          }
          update: {
            args: Prisma.CustomsTariffRateUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>
          }
          deleteMany: {
            args: Prisma.CustomsTariffRateDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CustomsTariffRateUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CustomsTariffRateUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>[]
          }
          upsert: {
            args: Prisma.CustomsTariffRateUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomsTariffRatePayload>
          }
          aggregate: {
            args: Prisma.CustomsTariffRateAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomsTariffRate>
          }
          groupBy: {
            args: Prisma.CustomsTariffRateGroupByArgs<ExtArgs>
            result: $Utils.Optional<CustomsTariffRateGroupByOutputType>[]
          }
          count: {
            args: Prisma.CustomsTariffRateCountArgs<ExtArgs>
            result: $Utils.Optional<CustomsTariffRateCountAggregateOutputType> | number
          }
        }
      }
      UnitOfMeasure: {
        payload: Prisma.$UnitOfMeasurePayload<ExtArgs>
        fields: Prisma.UnitOfMeasureFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UnitOfMeasureFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UnitOfMeasureFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>
          }
          findFirst: {
            args: Prisma.UnitOfMeasureFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UnitOfMeasureFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>
          }
          findMany: {
            args: Prisma.UnitOfMeasureFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>[]
          }
          create: {
            args: Prisma.UnitOfMeasureCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>
          }
          createMany: {
            args: Prisma.UnitOfMeasureCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UnitOfMeasureCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>[]
          }
          delete: {
            args: Prisma.UnitOfMeasureDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>
          }
          update: {
            args: Prisma.UnitOfMeasureUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>
          }
          deleteMany: {
            args: Prisma.UnitOfMeasureDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UnitOfMeasureUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UnitOfMeasureUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>[]
          }
          upsert: {
            args: Prisma.UnitOfMeasureUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnitOfMeasurePayload>
          }
          aggregate: {
            args: Prisma.UnitOfMeasureAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUnitOfMeasure>
          }
          groupBy: {
            args: Prisma.UnitOfMeasureGroupByArgs<ExtArgs>
            result: $Utils.Optional<UnitOfMeasureGroupByOutputType>[]
          }
          count: {
            args: Prisma.UnitOfMeasureCountArgs<ExtArgs>
            result: $Utils.Optional<UnitOfMeasureCountAggregateOutputType> | number
          }
        }
      }
      Currency: {
        payload: Prisma.$CurrencyPayload<ExtArgs>
        fields: Prisma.CurrencyFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CurrencyFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CurrencyFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>
          }
          findFirst: {
            args: Prisma.CurrencyFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CurrencyFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>
          }
          findMany: {
            args: Prisma.CurrencyFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>[]
          }
          create: {
            args: Prisma.CurrencyCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>
          }
          createMany: {
            args: Prisma.CurrencyCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CurrencyCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>[]
          }
          delete: {
            args: Prisma.CurrencyDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>
          }
          update: {
            args: Prisma.CurrencyUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>
          }
          deleteMany: {
            args: Prisma.CurrencyDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CurrencyUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CurrencyUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>[]
          }
          upsert: {
            args: Prisma.CurrencyUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CurrencyPayload>
          }
          aggregate: {
            args: Prisma.CurrencyAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCurrency>
          }
          groupBy: {
            args: Prisma.CurrencyGroupByArgs<ExtArgs>
            result: $Utils.Optional<CurrencyGroupByOutputType>[]
          }
          count: {
            args: Prisma.CurrencyCountArgs<ExtArgs>
            result: $Utils.Optional<CurrencyCountAggregateOutputType> | number
          }
        }
      }
      Country: {
        payload: Prisma.$CountryPayload<ExtArgs>
        fields: Prisma.CountryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CountryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CountryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>
          }
          findFirst: {
            args: Prisma.CountryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CountryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>
          }
          findMany: {
            args: Prisma.CountryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>[]
          }
          create: {
            args: Prisma.CountryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>
          }
          createMany: {
            args: Prisma.CountryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CountryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>[]
          }
          delete: {
            args: Prisma.CountryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>
          }
          update: {
            args: Prisma.CountryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>
          }
          deleteMany: {
            args: Prisma.CountryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CountryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CountryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>[]
          }
          upsert: {
            args: Prisma.CountryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CountryPayload>
          }
          aggregate: {
            args: Prisma.CountryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCountry>
          }
          groupBy: {
            args: Prisma.CountryGroupByArgs<ExtArgs>
            result: $Utils.Optional<CountryGroupByOutputType>[]
          }
          count: {
            args: Prisma.CountryCountArgs<ExtArgs>
            result: $Utils.Optional<CountryCountAggregateOutputType> | number
          }
        }
      }
      City: {
        payload: Prisma.$CityPayload<ExtArgs>
        fields: Prisma.CityFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CityFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CityFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>
          }
          findFirst: {
            args: Prisma.CityFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CityFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>
          }
          findMany: {
            args: Prisma.CityFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>[]
          }
          create: {
            args: Prisma.CityCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>
          }
          createMany: {
            args: Prisma.CityCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CityCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>[]
          }
          delete: {
            args: Prisma.CityDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>
          }
          update: {
            args: Prisma.CityUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>
          }
          deleteMany: {
            args: Prisma.CityDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CityUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CityUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>[]
          }
          upsert: {
            args: Prisma.CityUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CityPayload>
          }
          aggregate: {
            args: Prisma.CityAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCity>
          }
          groupBy: {
            args: Prisma.CityGroupByArgs<ExtArgs>
            result: $Utils.Optional<CityGroupByOutputType>[]
          }
          count: {
            args: Prisma.CityCountArgs<ExtArgs>
            result: $Utils.Optional<CityCountAggregateOutputType> | number
          }
        }
      }
      TaxRate: {
        payload: Prisma.$TaxRatePayload<ExtArgs>
        fields: Prisma.TaxRateFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TaxRateFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TaxRateFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>
          }
          findFirst: {
            args: Prisma.TaxRateFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TaxRateFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>
          }
          findMany: {
            args: Prisma.TaxRateFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>[]
          }
          create: {
            args: Prisma.TaxRateCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>
          }
          createMany: {
            args: Prisma.TaxRateCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TaxRateCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>[]
          }
          delete: {
            args: Prisma.TaxRateDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>
          }
          update: {
            args: Prisma.TaxRateUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>
          }
          deleteMany: {
            args: Prisma.TaxRateDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TaxRateUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TaxRateUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>[]
          }
          upsert: {
            args: Prisma.TaxRateUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TaxRatePayload>
          }
          aggregate: {
            args: Prisma.TaxRateAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTaxRate>
          }
          groupBy: {
            args: Prisma.TaxRateGroupByArgs<ExtArgs>
            result: $Utils.Optional<TaxRateGroupByOutputType>[]
          }
          count: {
            args: Prisma.TaxRateCountArgs<ExtArgs>
            result: $Utils.Optional<TaxRateCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    calendarDay?: CalendarDayOmit
    cbarOfficialRate?: CbarOfficialRateOmit
    globalCompanyDirectory?: GlobalCompanyDirectoryOmit
    bankGlossary?: BankGlossaryOmit
    bankBranch?: BankBranchOmit
    customsTariffRate?: CustomsTariffRateOmit
    unitOfMeasure?: UnitOfMeasureOmit
    currency?: CurrencyOmit
    country?: CountryOmit
    city?: CityOmit
    taxRate?: TaxRateOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type BankGlossaryCountOutputType
   */

  export type BankGlossaryCountOutputType = {
    branches: number
  }

  export type BankGlossaryCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    branches?: boolean | BankGlossaryCountOutputTypeCountBranchesArgs
  }

  // Custom InputTypes
  /**
   * BankGlossaryCountOutputType without action
   */
  export type BankGlossaryCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossaryCountOutputType
     */
    select?: BankGlossaryCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * BankGlossaryCountOutputType without action
   */
  export type BankGlossaryCountOutputTypeCountBranchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BankBranchWhereInput
  }


  /**
   * Count Type CountryCountOutputType
   */

  export type CountryCountOutputType = {
    cities: number
  }

  export type CountryCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    cities?: boolean | CountryCountOutputTypeCountCitiesArgs
  }

  // Custom InputTypes
  /**
   * CountryCountOutputType without action
   */
  export type CountryCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CountryCountOutputType
     */
    select?: CountryCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CountryCountOutputType without action
   */
  export type CountryCountOutputTypeCountCitiesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CityWhereInput
  }


  /**
   * Models
   */

  /**
   * Model CalendarDay
   */

  export type AggregateCalendarDay = {
    _count: CalendarDayCountAggregateOutputType | null
    _min: CalendarDayMinAggregateOutputType | null
    _max: CalendarDayMaxAggregateOutputType | null
  }

  export type CalendarDayMinAggregateOutputType = {
    id: string | null
    country: string | null
    date: Date | null
    isWorking: boolean | null
    dayType: string | null
    labelAz: string | null
    labelRu: string | null
    labelEn: string | null
    source: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CalendarDayMaxAggregateOutputType = {
    id: string | null
    country: string | null
    date: Date | null
    isWorking: boolean | null
    dayType: string | null
    labelAz: string | null
    labelRu: string | null
    labelEn: string | null
    source: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CalendarDayCountAggregateOutputType = {
    id: number
    country: number
    date: number
    isWorking: number
    dayType: number
    labelAz: number
    labelRu: number
    labelEn: number
    source: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CalendarDayMinAggregateInputType = {
    id?: true
    country?: true
    date?: true
    isWorking?: true
    dayType?: true
    labelAz?: true
    labelRu?: true
    labelEn?: true
    source?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CalendarDayMaxAggregateInputType = {
    id?: true
    country?: true
    date?: true
    isWorking?: true
    dayType?: true
    labelAz?: true
    labelRu?: true
    labelEn?: true
    source?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CalendarDayCountAggregateInputType = {
    id?: true
    country?: true
    date?: true
    isWorking?: true
    dayType?: true
    labelAz?: true
    labelRu?: true
    labelEn?: true
    source?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CalendarDayAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CalendarDay to aggregate.
     */
    where?: CalendarDayWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CalendarDays to fetch.
     */
    orderBy?: CalendarDayOrderByWithRelationInput | CalendarDayOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CalendarDayWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CalendarDays from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CalendarDays.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CalendarDays
    **/
    _count?: true | CalendarDayCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CalendarDayMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CalendarDayMaxAggregateInputType
  }

  export type GetCalendarDayAggregateType<T extends CalendarDayAggregateArgs> = {
        [P in keyof T & keyof AggregateCalendarDay]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCalendarDay[P]>
      : GetScalarType<T[P], AggregateCalendarDay[P]>
  }




  export type CalendarDayGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CalendarDayWhereInput
    orderBy?: CalendarDayOrderByWithAggregationInput | CalendarDayOrderByWithAggregationInput[]
    by: CalendarDayScalarFieldEnum[] | CalendarDayScalarFieldEnum
    having?: CalendarDayScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CalendarDayCountAggregateInputType | true
    _min?: CalendarDayMinAggregateInputType
    _max?: CalendarDayMaxAggregateInputType
  }

  export type CalendarDayGroupByOutputType = {
    id: string
    country: string
    date: Date
    isWorking: boolean
    dayType: string
    labelAz: string | null
    labelRu: string | null
    labelEn: string | null
    source: string
    createdAt: Date
    updatedAt: Date
    _count: CalendarDayCountAggregateOutputType | null
    _min: CalendarDayMinAggregateOutputType | null
    _max: CalendarDayMaxAggregateOutputType | null
  }

  type GetCalendarDayGroupByPayload<T extends CalendarDayGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CalendarDayGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CalendarDayGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CalendarDayGroupByOutputType[P]>
            : GetScalarType<T[P], CalendarDayGroupByOutputType[P]>
        }
      >
    >


  export type CalendarDaySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    country?: boolean
    date?: boolean
    isWorking?: boolean
    dayType?: boolean
    labelAz?: boolean
    labelRu?: boolean
    labelEn?: boolean
    source?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["calendarDay"]>

  export type CalendarDaySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    country?: boolean
    date?: boolean
    isWorking?: boolean
    dayType?: boolean
    labelAz?: boolean
    labelRu?: boolean
    labelEn?: boolean
    source?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["calendarDay"]>

  export type CalendarDaySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    country?: boolean
    date?: boolean
    isWorking?: boolean
    dayType?: boolean
    labelAz?: boolean
    labelRu?: boolean
    labelEn?: boolean
    source?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["calendarDay"]>

  export type CalendarDaySelectScalar = {
    id?: boolean
    country?: boolean
    date?: boolean
    isWorking?: boolean
    dayType?: boolean
    labelAz?: boolean
    labelRu?: boolean
    labelEn?: boolean
    source?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CalendarDayOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "country" | "date" | "isWorking" | "dayType" | "labelAz" | "labelRu" | "labelEn" | "source" | "createdAt" | "updatedAt", ExtArgs["result"]["calendarDay"]>

  export type $CalendarDayPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CalendarDay"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      country: string
      date: Date
      isWorking: boolean
      dayType: string
      labelAz: string | null
      labelRu: string | null
      labelEn: string | null
      source: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["calendarDay"]>
    composites: {}
  }

  type CalendarDayGetPayload<S extends boolean | null | undefined | CalendarDayDefaultArgs> = $Result.GetResult<Prisma.$CalendarDayPayload, S>

  type CalendarDayCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CalendarDayFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CalendarDayCountAggregateInputType | true
    }

  export interface CalendarDayDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CalendarDay'], meta: { name: 'CalendarDay' } }
    /**
     * Find zero or one CalendarDay that matches the filter.
     * @param {CalendarDayFindUniqueArgs} args - Arguments to find a CalendarDay
     * @example
     * // Get one CalendarDay
     * const calendarDay = await prisma.calendarDay.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CalendarDayFindUniqueArgs>(args: SelectSubset<T, CalendarDayFindUniqueArgs<ExtArgs>>): Prisma__CalendarDayClient<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CalendarDay that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CalendarDayFindUniqueOrThrowArgs} args - Arguments to find a CalendarDay
     * @example
     * // Get one CalendarDay
     * const calendarDay = await prisma.calendarDay.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CalendarDayFindUniqueOrThrowArgs>(args: SelectSubset<T, CalendarDayFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CalendarDayClient<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CalendarDay that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarDayFindFirstArgs} args - Arguments to find a CalendarDay
     * @example
     * // Get one CalendarDay
     * const calendarDay = await prisma.calendarDay.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CalendarDayFindFirstArgs>(args?: SelectSubset<T, CalendarDayFindFirstArgs<ExtArgs>>): Prisma__CalendarDayClient<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CalendarDay that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarDayFindFirstOrThrowArgs} args - Arguments to find a CalendarDay
     * @example
     * // Get one CalendarDay
     * const calendarDay = await prisma.calendarDay.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CalendarDayFindFirstOrThrowArgs>(args?: SelectSubset<T, CalendarDayFindFirstOrThrowArgs<ExtArgs>>): Prisma__CalendarDayClient<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CalendarDays that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarDayFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CalendarDays
     * const calendarDays = await prisma.calendarDay.findMany()
     * 
     * // Get first 10 CalendarDays
     * const calendarDays = await prisma.calendarDay.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const calendarDayWithIdOnly = await prisma.calendarDay.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CalendarDayFindManyArgs>(args?: SelectSubset<T, CalendarDayFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CalendarDay.
     * @param {CalendarDayCreateArgs} args - Arguments to create a CalendarDay.
     * @example
     * // Create one CalendarDay
     * const CalendarDay = await prisma.calendarDay.create({
     *   data: {
     *     // ... data to create a CalendarDay
     *   }
     * })
     * 
     */
    create<T extends CalendarDayCreateArgs>(args: SelectSubset<T, CalendarDayCreateArgs<ExtArgs>>): Prisma__CalendarDayClient<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CalendarDays.
     * @param {CalendarDayCreateManyArgs} args - Arguments to create many CalendarDays.
     * @example
     * // Create many CalendarDays
     * const calendarDay = await prisma.calendarDay.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CalendarDayCreateManyArgs>(args?: SelectSubset<T, CalendarDayCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CalendarDays and returns the data saved in the database.
     * @param {CalendarDayCreateManyAndReturnArgs} args - Arguments to create many CalendarDays.
     * @example
     * // Create many CalendarDays
     * const calendarDay = await prisma.calendarDay.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CalendarDays and only return the `id`
     * const calendarDayWithIdOnly = await prisma.calendarDay.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CalendarDayCreateManyAndReturnArgs>(args?: SelectSubset<T, CalendarDayCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CalendarDay.
     * @param {CalendarDayDeleteArgs} args - Arguments to delete one CalendarDay.
     * @example
     * // Delete one CalendarDay
     * const CalendarDay = await prisma.calendarDay.delete({
     *   where: {
     *     // ... filter to delete one CalendarDay
     *   }
     * })
     * 
     */
    delete<T extends CalendarDayDeleteArgs>(args: SelectSubset<T, CalendarDayDeleteArgs<ExtArgs>>): Prisma__CalendarDayClient<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CalendarDay.
     * @param {CalendarDayUpdateArgs} args - Arguments to update one CalendarDay.
     * @example
     * // Update one CalendarDay
     * const calendarDay = await prisma.calendarDay.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CalendarDayUpdateArgs>(args: SelectSubset<T, CalendarDayUpdateArgs<ExtArgs>>): Prisma__CalendarDayClient<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CalendarDays.
     * @param {CalendarDayDeleteManyArgs} args - Arguments to filter CalendarDays to delete.
     * @example
     * // Delete a few CalendarDays
     * const { count } = await prisma.calendarDay.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CalendarDayDeleteManyArgs>(args?: SelectSubset<T, CalendarDayDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CalendarDays.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarDayUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CalendarDays
     * const calendarDay = await prisma.calendarDay.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CalendarDayUpdateManyArgs>(args: SelectSubset<T, CalendarDayUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CalendarDays and returns the data updated in the database.
     * @param {CalendarDayUpdateManyAndReturnArgs} args - Arguments to update many CalendarDays.
     * @example
     * // Update many CalendarDays
     * const calendarDay = await prisma.calendarDay.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CalendarDays and only return the `id`
     * const calendarDayWithIdOnly = await prisma.calendarDay.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CalendarDayUpdateManyAndReturnArgs>(args: SelectSubset<T, CalendarDayUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CalendarDay.
     * @param {CalendarDayUpsertArgs} args - Arguments to update or create a CalendarDay.
     * @example
     * // Update or create a CalendarDay
     * const calendarDay = await prisma.calendarDay.upsert({
     *   create: {
     *     // ... data to create a CalendarDay
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CalendarDay we want to update
     *   }
     * })
     */
    upsert<T extends CalendarDayUpsertArgs>(args: SelectSubset<T, CalendarDayUpsertArgs<ExtArgs>>): Prisma__CalendarDayClient<$Result.GetResult<Prisma.$CalendarDayPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CalendarDays.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarDayCountArgs} args - Arguments to filter CalendarDays to count.
     * @example
     * // Count the number of CalendarDays
     * const count = await prisma.calendarDay.count({
     *   where: {
     *     // ... the filter for the CalendarDays we want to count
     *   }
     * })
    **/
    count<T extends CalendarDayCountArgs>(
      args?: Subset<T, CalendarDayCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CalendarDayCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CalendarDay.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarDayAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CalendarDayAggregateArgs>(args: Subset<T, CalendarDayAggregateArgs>): Prisma.PrismaPromise<GetCalendarDayAggregateType<T>>

    /**
     * Group by CalendarDay.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarDayGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CalendarDayGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CalendarDayGroupByArgs['orderBy'] }
        : { orderBy?: CalendarDayGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CalendarDayGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCalendarDayGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CalendarDay model
   */
  readonly fields: CalendarDayFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CalendarDay.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CalendarDayClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CalendarDay model
   */
  interface CalendarDayFieldRefs {
    readonly id: FieldRef<"CalendarDay", 'String'>
    readonly country: FieldRef<"CalendarDay", 'String'>
    readonly date: FieldRef<"CalendarDay", 'DateTime'>
    readonly isWorking: FieldRef<"CalendarDay", 'Boolean'>
    readonly dayType: FieldRef<"CalendarDay", 'String'>
    readonly labelAz: FieldRef<"CalendarDay", 'String'>
    readonly labelRu: FieldRef<"CalendarDay", 'String'>
    readonly labelEn: FieldRef<"CalendarDay", 'String'>
    readonly source: FieldRef<"CalendarDay", 'String'>
    readonly createdAt: FieldRef<"CalendarDay", 'DateTime'>
    readonly updatedAt: FieldRef<"CalendarDay", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CalendarDay findUnique
   */
  export type CalendarDayFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * Filter, which CalendarDay to fetch.
     */
    where: CalendarDayWhereUniqueInput
  }

  /**
   * CalendarDay findUniqueOrThrow
   */
  export type CalendarDayFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * Filter, which CalendarDay to fetch.
     */
    where: CalendarDayWhereUniqueInput
  }

  /**
   * CalendarDay findFirst
   */
  export type CalendarDayFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * Filter, which CalendarDay to fetch.
     */
    where?: CalendarDayWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CalendarDays to fetch.
     */
    orderBy?: CalendarDayOrderByWithRelationInput | CalendarDayOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CalendarDays.
     */
    cursor?: CalendarDayWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CalendarDays from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CalendarDays.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CalendarDays.
     */
    distinct?: CalendarDayScalarFieldEnum | CalendarDayScalarFieldEnum[]
  }

  /**
   * CalendarDay findFirstOrThrow
   */
  export type CalendarDayFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * Filter, which CalendarDay to fetch.
     */
    where?: CalendarDayWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CalendarDays to fetch.
     */
    orderBy?: CalendarDayOrderByWithRelationInput | CalendarDayOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CalendarDays.
     */
    cursor?: CalendarDayWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CalendarDays from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CalendarDays.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CalendarDays.
     */
    distinct?: CalendarDayScalarFieldEnum | CalendarDayScalarFieldEnum[]
  }

  /**
   * CalendarDay findMany
   */
  export type CalendarDayFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * Filter, which CalendarDays to fetch.
     */
    where?: CalendarDayWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CalendarDays to fetch.
     */
    orderBy?: CalendarDayOrderByWithRelationInput | CalendarDayOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CalendarDays.
     */
    cursor?: CalendarDayWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CalendarDays from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CalendarDays.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CalendarDays.
     */
    distinct?: CalendarDayScalarFieldEnum | CalendarDayScalarFieldEnum[]
  }

  /**
   * CalendarDay create
   */
  export type CalendarDayCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * The data needed to create a CalendarDay.
     */
    data: XOR<CalendarDayCreateInput, CalendarDayUncheckedCreateInput>
  }

  /**
   * CalendarDay createMany
   */
  export type CalendarDayCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CalendarDays.
     */
    data: CalendarDayCreateManyInput | CalendarDayCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CalendarDay createManyAndReturn
   */
  export type CalendarDayCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * The data used to create many CalendarDays.
     */
    data: CalendarDayCreateManyInput | CalendarDayCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CalendarDay update
   */
  export type CalendarDayUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * The data needed to update a CalendarDay.
     */
    data: XOR<CalendarDayUpdateInput, CalendarDayUncheckedUpdateInput>
    /**
     * Choose, which CalendarDay to update.
     */
    where: CalendarDayWhereUniqueInput
  }

  /**
   * CalendarDay updateMany
   */
  export type CalendarDayUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CalendarDays.
     */
    data: XOR<CalendarDayUpdateManyMutationInput, CalendarDayUncheckedUpdateManyInput>
    /**
     * Filter which CalendarDays to update
     */
    where?: CalendarDayWhereInput
    /**
     * Limit how many CalendarDays to update.
     */
    limit?: number
  }

  /**
   * CalendarDay updateManyAndReturn
   */
  export type CalendarDayUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * The data used to update CalendarDays.
     */
    data: XOR<CalendarDayUpdateManyMutationInput, CalendarDayUncheckedUpdateManyInput>
    /**
     * Filter which CalendarDays to update
     */
    where?: CalendarDayWhereInput
    /**
     * Limit how many CalendarDays to update.
     */
    limit?: number
  }

  /**
   * CalendarDay upsert
   */
  export type CalendarDayUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * The filter to search for the CalendarDay to update in case it exists.
     */
    where: CalendarDayWhereUniqueInput
    /**
     * In case the CalendarDay found by the `where` argument doesn't exist, create a new CalendarDay with this data.
     */
    create: XOR<CalendarDayCreateInput, CalendarDayUncheckedCreateInput>
    /**
     * In case the CalendarDay was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CalendarDayUpdateInput, CalendarDayUncheckedUpdateInput>
  }

  /**
   * CalendarDay delete
   */
  export type CalendarDayDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
    /**
     * Filter which CalendarDay to delete.
     */
    where: CalendarDayWhereUniqueInput
  }

  /**
   * CalendarDay deleteMany
   */
  export type CalendarDayDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CalendarDays to delete
     */
    where?: CalendarDayWhereInput
    /**
     * Limit how many CalendarDays to delete.
     */
    limit?: number
  }

  /**
   * CalendarDay without action
   */
  export type CalendarDayDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarDay
     */
    select?: CalendarDaySelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarDay
     */
    omit?: CalendarDayOmit<ExtArgs> | null
  }


  /**
   * Model CbarOfficialRate
   */

  export type AggregateCbarOfficialRate = {
    _count: CbarOfficialRateCountAggregateOutputType | null
    _avg: CbarOfficialRateAvgAggregateOutputType | null
    _sum: CbarOfficialRateSumAggregateOutputType | null
    _min: CbarOfficialRateMinAggregateOutputType | null
    _max: CbarOfficialRateMaxAggregateOutputType | null
  }

  export type CbarOfficialRateAvgAggregateOutputType = {
    value: Decimal | null
    nominal: number | null
    rate: Decimal | null
  }

  export type CbarOfficialRateSumAggregateOutputType = {
    value: Decimal | null
    nominal: number | null
    rate: Decimal | null
  }

  export type CbarOfficialRateMinAggregateOutputType = {
    id: string | null
    rateDate: Date | null
    currencyCode: string | null
    value: Decimal | null
    nominal: number | null
    rate: Decimal | null
    status: $Enums.CbarRateStatus | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CbarOfficialRateMaxAggregateOutputType = {
    id: string | null
    rateDate: Date | null
    currencyCode: string | null
    value: Decimal | null
    nominal: number | null
    rate: Decimal | null
    status: $Enums.CbarRateStatus | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CbarOfficialRateCountAggregateOutputType = {
    id: number
    rateDate: number
    currencyCode: number
    value: number
    nominal: number
    rate: number
    status: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CbarOfficialRateAvgAggregateInputType = {
    value?: true
    nominal?: true
    rate?: true
  }

  export type CbarOfficialRateSumAggregateInputType = {
    value?: true
    nominal?: true
    rate?: true
  }

  export type CbarOfficialRateMinAggregateInputType = {
    id?: true
    rateDate?: true
    currencyCode?: true
    value?: true
    nominal?: true
    rate?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CbarOfficialRateMaxAggregateInputType = {
    id?: true
    rateDate?: true
    currencyCode?: true
    value?: true
    nominal?: true
    rate?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CbarOfficialRateCountAggregateInputType = {
    id?: true
    rateDate?: true
    currencyCode?: true
    value?: true
    nominal?: true
    rate?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CbarOfficialRateAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CbarOfficialRate to aggregate.
     */
    where?: CbarOfficialRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CbarOfficialRates to fetch.
     */
    orderBy?: CbarOfficialRateOrderByWithRelationInput | CbarOfficialRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CbarOfficialRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CbarOfficialRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CbarOfficialRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CbarOfficialRates
    **/
    _count?: true | CbarOfficialRateCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CbarOfficialRateAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CbarOfficialRateSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CbarOfficialRateMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CbarOfficialRateMaxAggregateInputType
  }

  export type GetCbarOfficialRateAggregateType<T extends CbarOfficialRateAggregateArgs> = {
        [P in keyof T & keyof AggregateCbarOfficialRate]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCbarOfficialRate[P]>
      : GetScalarType<T[P], AggregateCbarOfficialRate[P]>
  }




  export type CbarOfficialRateGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CbarOfficialRateWhereInput
    orderBy?: CbarOfficialRateOrderByWithAggregationInput | CbarOfficialRateOrderByWithAggregationInput[]
    by: CbarOfficialRateScalarFieldEnum[] | CbarOfficialRateScalarFieldEnum
    having?: CbarOfficialRateScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CbarOfficialRateCountAggregateInputType | true
    _avg?: CbarOfficialRateAvgAggregateInputType
    _sum?: CbarOfficialRateSumAggregateInputType
    _min?: CbarOfficialRateMinAggregateInputType
    _max?: CbarOfficialRateMaxAggregateInputType
  }

  export type CbarOfficialRateGroupByOutputType = {
    id: string
    rateDate: Date
    currencyCode: string
    value: Decimal
    nominal: number
    rate: Decimal
    status: $Enums.CbarRateStatus
    createdAt: Date
    updatedAt: Date
    _count: CbarOfficialRateCountAggregateOutputType | null
    _avg: CbarOfficialRateAvgAggregateOutputType | null
    _sum: CbarOfficialRateSumAggregateOutputType | null
    _min: CbarOfficialRateMinAggregateOutputType | null
    _max: CbarOfficialRateMaxAggregateOutputType | null
  }

  type GetCbarOfficialRateGroupByPayload<T extends CbarOfficialRateGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CbarOfficialRateGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CbarOfficialRateGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CbarOfficialRateGroupByOutputType[P]>
            : GetScalarType<T[P], CbarOfficialRateGroupByOutputType[P]>
        }
      >
    >


  export type CbarOfficialRateSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    rateDate?: boolean
    currencyCode?: boolean
    value?: boolean
    nominal?: boolean
    rate?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["cbarOfficialRate"]>

  export type CbarOfficialRateSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    rateDate?: boolean
    currencyCode?: boolean
    value?: boolean
    nominal?: boolean
    rate?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["cbarOfficialRate"]>

  export type CbarOfficialRateSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    rateDate?: boolean
    currencyCode?: boolean
    value?: boolean
    nominal?: boolean
    rate?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["cbarOfficialRate"]>

  export type CbarOfficialRateSelectScalar = {
    id?: boolean
    rateDate?: boolean
    currencyCode?: boolean
    value?: boolean
    nominal?: boolean
    rate?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CbarOfficialRateOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "rateDate" | "currencyCode" | "value" | "nominal" | "rate" | "status" | "createdAt" | "updatedAt", ExtArgs["result"]["cbarOfficialRate"]>

  export type $CbarOfficialRatePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CbarOfficialRate"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      rateDate: Date
      currencyCode: string
      value: Prisma.Decimal
      nominal: number
      rate: Prisma.Decimal
      status: $Enums.CbarRateStatus
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["cbarOfficialRate"]>
    composites: {}
  }

  type CbarOfficialRateGetPayload<S extends boolean | null | undefined | CbarOfficialRateDefaultArgs> = $Result.GetResult<Prisma.$CbarOfficialRatePayload, S>

  type CbarOfficialRateCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CbarOfficialRateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CbarOfficialRateCountAggregateInputType | true
    }

  export interface CbarOfficialRateDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CbarOfficialRate'], meta: { name: 'CbarOfficialRate' } }
    /**
     * Find zero or one CbarOfficialRate that matches the filter.
     * @param {CbarOfficialRateFindUniqueArgs} args - Arguments to find a CbarOfficialRate
     * @example
     * // Get one CbarOfficialRate
     * const cbarOfficialRate = await prisma.cbarOfficialRate.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CbarOfficialRateFindUniqueArgs>(args: SelectSubset<T, CbarOfficialRateFindUniqueArgs<ExtArgs>>): Prisma__CbarOfficialRateClient<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CbarOfficialRate that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CbarOfficialRateFindUniqueOrThrowArgs} args - Arguments to find a CbarOfficialRate
     * @example
     * // Get one CbarOfficialRate
     * const cbarOfficialRate = await prisma.cbarOfficialRate.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CbarOfficialRateFindUniqueOrThrowArgs>(args: SelectSubset<T, CbarOfficialRateFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CbarOfficialRateClient<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CbarOfficialRate that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CbarOfficialRateFindFirstArgs} args - Arguments to find a CbarOfficialRate
     * @example
     * // Get one CbarOfficialRate
     * const cbarOfficialRate = await prisma.cbarOfficialRate.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CbarOfficialRateFindFirstArgs>(args?: SelectSubset<T, CbarOfficialRateFindFirstArgs<ExtArgs>>): Prisma__CbarOfficialRateClient<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CbarOfficialRate that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CbarOfficialRateFindFirstOrThrowArgs} args - Arguments to find a CbarOfficialRate
     * @example
     * // Get one CbarOfficialRate
     * const cbarOfficialRate = await prisma.cbarOfficialRate.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CbarOfficialRateFindFirstOrThrowArgs>(args?: SelectSubset<T, CbarOfficialRateFindFirstOrThrowArgs<ExtArgs>>): Prisma__CbarOfficialRateClient<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CbarOfficialRates that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CbarOfficialRateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CbarOfficialRates
     * const cbarOfficialRates = await prisma.cbarOfficialRate.findMany()
     * 
     * // Get first 10 CbarOfficialRates
     * const cbarOfficialRates = await prisma.cbarOfficialRate.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const cbarOfficialRateWithIdOnly = await prisma.cbarOfficialRate.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CbarOfficialRateFindManyArgs>(args?: SelectSubset<T, CbarOfficialRateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CbarOfficialRate.
     * @param {CbarOfficialRateCreateArgs} args - Arguments to create a CbarOfficialRate.
     * @example
     * // Create one CbarOfficialRate
     * const CbarOfficialRate = await prisma.cbarOfficialRate.create({
     *   data: {
     *     // ... data to create a CbarOfficialRate
     *   }
     * })
     * 
     */
    create<T extends CbarOfficialRateCreateArgs>(args: SelectSubset<T, CbarOfficialRateCreateArgs<ExtArgs>>): Prisma__CbarOfficialRateClient<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CbarOfficialRates.
     * @param {CbarOfficialRateCreateManyArgs} args - Arguments to create many CbarOfficialRates.
     * @example
     * // Create many CbarOfficialRates
     * const cbarOfficialRate = await prisma.cbarOfficialRate.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CbarOfficialRateCreateManyArgs>(args?: SelectSubset<T, CbarOfficialRateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CbarOfficialRates and returns the data saved in the database.
     * @param {CbarOfficialRateCreateManyAndReturnArgs} args - Arguments to create many CbarOfficialRates.
     * @example
     * // Create many CbarOfficialRates
     * const cbarOfficialRate = await prisma.cbarOfficialRate.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CbarOfficialRates and only return the `id`
     * const cbarOfficialRateWithIdOnly = await prisma.cbarOfficialRate.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CbarOfficialRateCreateManyAndReturnArgs>(args?: SelectSubset<T, CbarOfficialRateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CbarOfficialRate.
     * @param {CbarOfficialRateDeleteArgs} args - Arguments to delete one CbarOfficialRate.
     * @example
     * // Delete one CbarOfficialRate
     * const CbarOfficialRate = await prisma.cbarOfficialRate.delete({
     *   where: {
     *     // ... filter to delete one CbarOfficialRate
     *   }
     * })
     * 
     */
    delete<T extends CbarOfficialRateDeleteArgs>(args: SelectSubset<T, CbarOfficialRateDeleteArgs<ExtArgs>>): Prisma__CbarOfficialRateClient<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CbarOfficialRate.
     * @param {CbarOfficialRateUpdateArgs} args - Arguments to update one CbarOfficialRate.
     * @example
     * // Update one CbarOfficialRate
     * const cbarOfficialRate = await prisma.cbarOfficialRate.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CbarOfficialRateUpdateArgs>(args: SelectSubset<T, CbarOfficialRateUpdateArgs<ExtArgs>>): Prisma__CbarOfficialRateClient<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CbarOfficialRates.
     * @param {CbarOfficialRateDeleteManyArgs} args - Arguments to filter CbarOfficialRates to delete.
     * @example
     * // Delete a few CbarOfficialRates
     * const { count } = await prisma.cbarOfficialRate.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CbarOfficialRateDeleteManyArgs>(args?: SelectSubset<T, CbarOfficialRateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CbarOfficialRates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CbarOfficialRateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CbarOfficialRates
     * const cbarOfficialRate = await prisma.cbarOfficialRate.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CbarOfficialRateUpdateManyArgs>(args: SelectSubset<T, CbarOfficialRateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CbarOfficialRates and returns the data updated in the database.
     * @param {CbarOfficialRateUpdateManyAndReturnArgs} args - Arguments to update many CbarOfficialRates.
     * @example
     * // Update many CbarOfficialRates
     * const cbarOfficialRate = await prisma.cbarOfficialRate.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CbarOfficialRates and only return the `id`
     * const cbarOfficialRateWithIdOnly = await prisma.cbarOfficialRate.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CbarOfficialRateUpdateManyAndReturnArgs>(args: SelectSubset<T, CbarOfficialRateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CbarOfficialRate.
     * @param {CbarOfficialRateUpsertArgs} args - Arguments to update or create a CbarOfficialRate.
     * @example
     * // Update or create a CbarOfficialRate
     * const cbarOfficialRate = await prisma.cbarOfficialRate.upsert({
     *   create: {
     *     // ... data to create a CbarOfficialRate
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CbarOfficialRate we want to update
     *   }
     * })
     */
    upsert<T extends CbarOfficialRateUpsertArgs>(args: SelectSubset<T, CbarOfficialRateUpsertArgs<ExtArgs>>): Prisma__CbarOfficialRateClient<$Result.GetResult<Prisma.$CbarOfficialRatePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CbarOfficialRates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CbarOfficialRateCountArgs} args - Arguments to filter CbarOfficialRates to count.
     * @example
     * // Count the number of CbarOfficialRates
     * const count = await prisma.cbarOfficialRate.count({
     *   where: {
     *     // ... the filter for the CbarOfficialRates we want to count
     *   }
     * })
    **/
    count<T extends CbarOfficialRateCountArgs>(
      args?: Subset<T, CbarOfficialRateCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CbarOfficialRateCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CbarOfficialRate.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CbarOfficialRateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CbarOfficialRateAggregateArgs>(args: Subset<T, CbarOfficialRateAggregateArgs>): Prisma.PrismaPromise<GetCbarOfficialRateAggregateType<T>>

    /**
     * Group by CbarOfficialRate.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CbarOfficialRateGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CbarOfficialRateGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CbarOfficialRateGroupByArgs['orderBy'] }
        : { orderBy?: CbarOfficialRateGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CbarOfficialRateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCbarOfficialRateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CbarOfficialRate model
   */
  readonly fields: CbarOfficialRateFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CbarOfficialRate.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CbarOfficialRateClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CbarOfficialRate model
   */
  interface CbarOfficialRateFieldRefs {
    readonly id: FieldRef<"CbarOfficialRate", 'String'>
    readonly rateDate: FieldRef<"CbarOfficialRate", 'DateTime'>
    readonly currencyCode: FieldRef<"CbarOfficialRate", 'String'>
    readonly value: FieldRef<"CbarOfficialRate", 'Decimal'>
    readonly nominal: FieldRef<"CbarOfficialRate", 'Int'>
    readonly rate: FieldRef<"CbarOfficialRate", 'Decimal'>
    readonly status: FieldRef<"CbarOfficialRate", 'CbarRateStatus'>
    readonly createdAt: FieldRef<"CbarOfficialRate", 'DateTime'>
    readonly updatedAt: FieldRef<"CbarOfficialRate", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CbarOfficialRate findUnique
   */
  export type CbarOfficialRateFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * Filter, which CbarOfficialRate to fetch.
     */
    where: CbarOfficialRateWhereUniqueInput
  }

  /**
   * CbarOfficialRate findUniqueOrThrow
   */
  export type CbarOfficialRateFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * Filter, which CbarOfficialRate to fetch.
     */
    where: CbarOfficialRateWhereUniqueInput
  }

  /**
   * CbarOfficialRate findFirst
   */
  export type CbarOfficialRateFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * Filter, which CbarOfficialRate to fetch.
     */
    where?: CbarOfficialRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CbarOfficialRates to fetch.
     */
    orderBy?: CbarOfficialRateOrderByWithRelationInput | CbarOfficialRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CbarOfficialRates.
     */
    cursor?: CbarOfficialRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CbarOfficialRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CbarOfficialRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CbarOfficialRates.
     */
    distinct?: CbarOfficialRateScalarFieldEnum | CbarOfficialRateScalarFieldEnum[]
  }

  /**
   * CbarOfficialRate findFirstOrThrow
   */
  export type CbarOfficialRateFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * Filter, which CbarOfficialRate to fetch.
     */
    where?: CbarOfficialRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CbarOfficialRates to fetch.
     */
    orderBy?: CbarOfficialRateOrderByWithRelationInput | CbarOfficialRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CbarOfficialRates.
     */
    cursor?: CbarOfficialRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CbarOfficialRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CbarOfficialRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CbarOfficialRates.
     */
    distinct?: CbarOfficialRateScalarFieldEnum | CbarOfficialRateScalarFieldEnum[]
  }

  /**
   * CbarOfficialRate findMany
   */
  export type CbarOfficialRateFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * Filter, which CbarOfficialRates to fetch.
     */
    where?: CbarOfficialRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CbarOfficialRates to fetch.
     */
    orderBy?: CbarOfficialRateOrderByWithRelationInput | CbarOfficialRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CbarOfficialRates.
     */
    cursor?: CbarOfficialRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CbarOfficialRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CbarOfficialRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CbarOfficialRates.
     */
    distinct?: CbarOfficialRateScalarFieldEnum | CbarOfficialRateScalarFieldEnum[]
  }

  /**
   * CbarOfficialRate create
   */
  export type CbarOfficialRateCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * The data needed to create a CbarOfficialRate.
     */
    data: XOR<CbarOfficialRateCreateInput, CbarOfficialRateUncheckedCreateInput>
  }

  /**
   * CbarOfficialRate createMany
   */
  export type CbarOfficialRateCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CbarOfficialRates.
     */
    data: CbarOfficialRateCreateManyInput | CbarOfficialRateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CbarOfficialRate createManyAndReturn
   */
  export type CbarOfficialRateCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * The data used to create many CbarOfficialRates.
     */
    data: CbarOfficialRateCreateManyInput | CbarOfficialRateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CbarOfficialRate update
   */
  export type CbarOfficialRateUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * The data needed to update a CbarOfficialRate.
     */
    data: XOR<CbarOfficialRateUpdateInput, CbarOfficialRateUncheckedUpdateInput>
    /**
     * Choose, which CbarOfficialRate to update.
     */
    where: CbarOfficialRateWhereUniqueInput
  }

  /**
   * CbarOfficialRate updateMany
   */
  export type CbarOfficialRateUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CbarOfficialRates.
     */
    data: XOR<CbarOfficialRateUpdateManyMutationInput, CbarOfficialRateUncheckedUpdateManyInput>
    /**
     * Filter which CbarOfficialRates to update
     */
    where?: CbarOfficialRateWhereInput
    /**
     * Limit how many CbarOfficialRates to update.
     */
    limit?: number
  }

  /**
   * CbarOfficialRate updateManyAndReturn
   */
  export type CbarOfficialRateUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * The data used to update CbarOfficialRates.
     */
    data: XOR<CbarOfficialRateUpdateManyMutationInput, CbarOfficialRateUncheckedUpdateManyInput>
    /**
     * Filter which CbarOfficialRates to update
     */
    where?: CbarOfficialRateWhereInput
    /**
     * Limit how many CbarOfficialRates to update.
     */
    limit?: number
  }

  /**
   * CbarOfficialRate upsert
   */
  export type CbarOfficialRateUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * The filter to search for the CbarOfficialRate to update in case it exists.
     */
    where: CbarOfficialRateWhereUniqueInput
    /**
     * In case the CbarOfficialRate found by the `where` argument doesn't exist, create a new CbarOfficialRate with this data.
     */
    create: XOR<CbarOfficialRateCreateInput, CbarOfficialRateUncheckedCreateInput>
    /**
     * In case the CbarOfficialRate was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CbarOfficialRateUpdateInput, CbarOfficialRateUncheckedUpdateInput>
  }

  /**
   * CbarOfficialRate delete
   */
  export type CbarOfficialRateDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
    /**
     * Filter which CbarOfficialRate to delete.
     */
    where: CbarOfficialRateWhereUniqueInput
  }

  /**
   * CbarOfficialRate deleteMany
   */
  export type CbarOfficialRateDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CbarOfficialRates to delete
     */
    where?: CbarOfficialRateWhereInput
    /**
     * Limit how many CbarOfficialRates to delete.
     */
    limit?: number
  }

  /**
   * CbarOfficialRate without action
   */
  export type CbarOfficialRateDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CbarOfficialRate
     */
    select?: CbarOfficialRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CbarOfficialRate
     */
    omit?: CbarOfficialRateOmit<ExtArgs> | null
  }


  /**
   * Model GlobalCompanyDirectory
   */

  export type AggregateGlobalCompanyDirectory = {
    _count: GlobalCompanyDirectoryCountAggregateOutputType | null
    _min: GlobalCompanyDirectoryMinAggregateOutputType | null
    _max: GlobalCompanyDirectoryMaxAggregateOutputType | null
  }

  export type GlobalCompanyDirectoryMinAggregateOutputType = {
    id: string | null
    taxId: string | null
    name: string | null
    legalForm: $Enums.CounterpartyLegalForm | null
    legalAddress: string | null
    phone: string | null
    directorName: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GlobalCompanyDirectoryMaxAggregateOutputType = {
    id: string | null
    taxId: string | null
    name: string | null
    legalForm: $Enums.CounterpartyLegalForm | null
    legalAddress: string | null
    phone: string | null
    directorName: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GlobalCompanyDirectoryCountAggregateOutputType = {
    id: number
    taxId: number
    name: number
    legalForm: number
    legalAddress: number
    phone: number
    directorName: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type GlobalCompanyDirectoryMinAggregateInputType = {
    id?: true
    taxId?: true
    name?: true
    legalForm?: true
    legalAddress?: true
    phone?: true
    directorName?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GlobalCompanyDirectoryMaxAggregateInputType = {
    id?: true
    taxId?: true
    name?: true
    legalForm?: true
    legalAddress?: true
    phone?: true
    directorName?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GlobalCompanyDirectoryCountAggregateInputType = {
    id?: true
    taxId?: true
    name?: true
    legalForm?: true
    legalAddress?: true
    phone?: true
    directorName?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type GlobalCompanyDirectoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GlobalCompanyDirectory to aggregate.
     */
    where?: GlobalCompanyDirectoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalCompanyDirectories to fetch.
     */
    orderBy?: GlobalCompanyDirectoryOrderByWithRelationInput | GlobalCompanyDirectoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: GlobalCompanyDirectoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalCompanyDirectories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalCompanyDirectories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned GlobalCompanyDirectories
    **/
    _count?: true | GlobalCompanyDirectoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GlobalCompanyDirectoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GlobalCompanyDirectoryMaxAggregateInputType
  }

  export type GetGlobalCompanyDirectoryAggregateType<T extends GlobalCompanyDirectoryAggregateArgs> = {
        [P in keyof T & keyof AggregateGlobalCompanyDirectory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGlobalCompanyDirectory[P]>
      : GetScalarType<T[P], AggregateGlobalCompanyDirectory[P]>
  }




  export type GlobalCompanyDirectoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GlobalCompanyDirectoryWhereInput
    orderBy?: GlobalCompanyDirectoryOrderByWithAggregationInput | GlobalCompanyDirectoryOrderByWithAggregationInput[]
    by: GlobalCompanyDirectoryScalarFieldEnum[] | GlobalCompanyDirectoryScalarFieldEnum
    having?: GlobalCompanyDirectoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GlobalCompanyDirectoryCountAggregateInputType | true
    _min?: GlobalCompanyDirectoryMinAggregateInputType
    _max?: GlobalCompanyDirectoryMaxAggregateInputType
  }

  export type GlobalCompanyDirectoryGroupByOutputType = {
    id: string
    taxId: string
    name: string
    legalForm: $Enums.CounterpartyLegalForm | null
    legalAddress: string | null
    phone: string | null
    directorName: string | null
    createdAt: Date
    updatedAt: Date
    _count: GlobalCompanyDirectoryCountAggregateOutputType | null
    _min: GlobalCompanyDirectoryMinAggregateOutputType | null
    _max: GlobalCompanyDirectoryMaxAggregateOutputType | null
  }

  type GetGlobalCompanyDirectoryGroupByPayload<T extends GlobalCompanyDirectoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GlobalCompanyDirectoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GlobalCompanyDirectoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GlobalCompanyDirectoryGroupByOutputType[P]>
            : GetScalarType<T[P], GlobalCompanyDirectoryGroupByOutputType[P]>
        }
      >
    >


  export type GlobalCompanyDirectorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    taxId?: boolean
    name?: boolean
    legalForm?: boolean
    legalAddress?: boolean
    phone?: boolean
    directorName?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["globalCompanyDirectory"]>

  export type GlobalCompanyDirectorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    taxId?: boolean
    name?: boolean
    legalForm?: boolean
    legalAddress?: boolean
    phone?: boolean
    directorName?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["globalCompanyDirectory"]>

  export type GlobalCompanyDirectorySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    taxId?: boolean
    name?: boolean
    legalForm?: boolean
    legalAddress?: boolean
    phone?: boolean
    directorName?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["globalCompanyDirectory"]>

  export type GlobalCompanyDirectorySelectScalar = {
    id?: boolean
    taxId?: boolean
    name?: boolean
    legalForm?: boolean
    legalAddress?: boolean
    phone?: boolean
    directorName?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type GlobalCompanyDirectoryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "taxId" | "name" | "legalForm" | "legalAddress" | "phone" | "directorName" | "createdAt" | "updatedAt", ExtArgs["result"]["globalCompanyDirectory"]>

  export type $GlobalCompanyDirectoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "GlobalCompanyDirectory"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      taxId: string
      name: string
      legalForm: $Enums.CounterpartyLegalForm | null
      legalAddress: string | null
      phone: string | null
      directorName: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["globalCompanyDirectory"]>
    composites: {}
  }

  type GlobalCompanyDirectoryGetPayload<S extends boolean | null | undefined | GlobalCompanyDirectoryDefaultArgs> = $Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload, S>

  type GlobalCompanyDirectoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<GlobalCompanyDirectoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GlobalCompanyDirectoryCountAggregateInputType | true
    }

  export interface GlobalCompanyDirectoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['GlobalCompanyDirectory'], meta: { name: 'GlobalCompanyDirectory' } }
    /**
     * Find zero or one GlobalCompanyDirectory that matches the filter.
     * @param {GlobalCompanyDirectoryFindUniqueArgs} args - Arguments to find a GlobalCompanyDirectory
     * @example
     * // Get one GlobalCompanyDirectory
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends GlobalCompanyDirectoryFindUniqueArgs>(args: SelectSubset<T, GlobalCompanyDirectoryFindUniqueArgs<ExtArgs>>): Prisma__GlobalCompanyDirectoryClient<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one GlobalCompanyDirectory that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {GlobalCompanyDirectoryFindUniqueOrThrowArgs} args - Arguments to find a GlobalCompanyDirectory
     * @example
     * // Get one GlobalCompanyDirectory
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends GlobalCompanyDirectoryFindUniqueOrThrowArgs>(args: SelectSubset<T, GlobalCompanyDirectoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__GlobalCompanyDirectoryClient<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GlobalCompanyDirectory that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalCompanyDirectoryFindFirstArgs} args - Arguments to find a GlobalCompanyDirectory
     * @example
     * // Get one GlobalCompanyDirectory
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends GlobalCompanyDirectoryFindFirstArgs>(args?: SelectSubset<T, GlobalCompanyDirectoryFindFirstArgs<ExtArgs>>): Prisma__GlobalCompanyDirectoryClient<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GlobalCompanyDirectory that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalCompanyDirectoryFindFirstOrThrowArgs} args - Arguments to find a GlobalCompanyDirectory
     * @example
     * // Get one GlobalCompanyDirectory
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends GlobalCompanyDirectoryFindFirstOrThrowArgs>(args?: SelectSubset<T, GlobalCompanyDirectoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__GlobalCompanyDirectoryClient<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more GlobalCompanyDirectories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalCompanyDirectoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all GlobalCompanyDirectories
     * const globalCompanyDirectories = await prisma.globalCompanyDirectory.findMany()
     * 
     * // Get first 10 GlobalCompanyDirectories
     * const globalCompanyDirectories = await prisma.globalCompanyDirectory.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const globalCompanyDirectoryWithIdOnly = await prisma.globalCompanyDirectory.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends GlobalCompanyDirectoryFindManyArgs>(args?: SelectSubset<T, GlobalCompanyDirectoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a GlobalCompanyDirectory.
     * @param {GlobalCompanyDirectoryCreateArgs} args - Arguments to create a GlobalCompanyDirectory.
     * @example
     * // Create one GlobalCompanyDirectory
     * const GlobalCompanyDirectory = await prisma.globalCompanyDirectory.create({
     *   data: {
     *     // ... data to create a GlobalCompanyDirectory
     *   }
     * })
     * 
     */
    create<T extends GlobalCompanyDirectoryCreateArgs>(args: SelectSubset<T, GlobalCompanyDirectoryCreateArgs<ExtArgs>>): Prisma__GlobalCompanyDirectoryClient<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many GlobalCompanyDirectories.
     * @param {GlobalCompanyDirectoryCreateManyArgs} args - Arguments to create many GlobalCompanyDirectories.
     * @example
     * // Create many GlobalCompanyDirectories
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends GlobalCompanyDirectoryCreateManyArgs>(args?: SelectSubset<T, GlobalCompanyDirectoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many GlobalCompanyDirectories and returns the data saved in the database.
     * @param {GlobalCompanyDirectoryCreateManyAndReturnArgs} args - Arguments to create many GlobalCompanyDirectories.
     * @example
     * // Create many GlobalCompanyDirectories
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many GlobalCompanyDirectories and only return the `id`
     * const globalCompanyDirectoryWithIdOnly = await prisma.globalCompanyDirectory.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends GlobalCompanyDirectoryCreateManyAndReturnArgs>(args?: SelectSubset<T, GlobalCompanyDirectoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a GlobalCompanyDirectory.
     * @param {GlobalCompanyDirectoryDeleteArgs} args - Arguments to delete one GlobalCompanyDirectory.
     * @example
     * // Delete one GlobalCompanyDirectory
     * const GlobalCompanyDirectory = await prisma.globalCompanyDirectory.delete({
     *   where: {
     *     // ... filter to delete one GlobalCompanyDirectory
     *   }
     * })
     * 
     */
    delete<T extends GlobalCompanyDirectoryDeleteArgs>(args: SelectSubset<T, GlobalCompanyDirectoryDeleteArgs<ExtArgs>>): Prisma__GlobalCompanyDirectoryClient<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one GlobalCompanyDirectory.
     * @param {GlobalCompanyDirectoryUpdateArgs} args - Arguments to update one GlobalCompanyDirectory.
     * @example
     * // Update one GlobalCompanyDirectory
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends GlobalCompanyDirectoryUpdateArgs>(args: SelectSubset<T, GlobalCompanyDirectoryUpdateArgs<ExtArgs>>): Prisma__GlobalCompanyDirectoryClient<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more GlobalCompanyDirectories.
     * @param {GlobalCompanyDirectoryDeleteManyArgs} args - Arguments to filter GlobalCompanyDirectories to delete.
     * @example
     * // Delete a few GlobalCompanyDirectories
     * const { count } = await prisma.globalCompanyDirectory.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends GlobalCompanyDirectoryDeleteManyArgs>(args?: SelectSubset<T, GlobalCompanyDirectoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GlobalCompanyDirectories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalCompanyDirectoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many GlobalCompanyDirectories
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends GlobalCompanyDirectoryUpdateManyArgs>(args: SelectSubset<T, GlobalCompanyDirectoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GlobalCompanyDirectories and returns the data updated in the database.
     * @param {GlobalCompanyDirectoryUpdateManyAndReturnArgs} args - Arguments to update many GlobalCompanyDirectories.
     * @example
     * // Update many GlobalCompanyDirectories
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more GlobalCompanyDirectories and only return the `id`
     * const globalCompanyDirectoryWithIdOnly = await prisma.globalCompanyDirectory.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends GlobalCompanyDirectoryUpdateManyAndReturnArgs>(args: SelectSubset<T, GlobalCompanyDirectoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one GlobalCompanyDirectory.
     * @param {GlobalCompanyDirectoryUpsertArgs} args - Arguments to update or create a GlobalCompanyDirectory.
     * @example
     * // Update or create a GlobalCompanyDirectory
     * const globalCompanyDirectory = await prisma.globalCompanyDirectory.upsert({
     *   create: {
     *     // ... data to create a GlobalCompanyDirectory
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the GlobalCompanyDirectory we want to update
     *   }
     * })
     */
    upsert<T extends GlobalCompanyDirectoryUpsertArgs>(args: SelectSubset<T, GlobalCompanyDirectoryUpsertArgs<ExtArgs>>): Prisma__GlobalCompanyDirectoryClient<$Result.GetResult<Prisma.$GlobalCompanyDirectoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of GlobalCompanyDirectories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalCompanyDirectoryCountArgs} args - Arguments to filter GlobalCompanyDirectories to count.
     * @example
     * // Count the number of GlobalCompanyDirectories
     * const count = await prisma.globalCompanyDirectory.count({
     *   where: {
     *     // ... the filter for the GlobalCompanyDirectories we want to count
     *   }
     * })
    **/
    count<T extends GlobalCompanyDirectoryCountArgs>(
      args?: Subset<T, GlobalCompanyDirectoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GlobalCompanyDirectoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a GlobalCompanyDirectory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalCompanyDirectoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends GlobalCompanyDirectoryAggregateArgs>(args: Subset<T, GlobalCompanyDirectoryAggregateArgs>): Prisma.PrismaPromise<GetGlobalCompanyDirectoryAggregateType<T>>

    /**
     * Group by GlobalCompanyDirectory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalCompanyDirectoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends GlobalCompanyDirectoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: GlobalCompanyDirectoryGroupByArgs['orderBy'] }
        : { orderBy?: GlobalCompanyDirectoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, GlobalCompanyDirectoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGlobalCompanyDirectoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the GlobalCompanyDirectory model
   */
  readonly fields: GlobalCompanyDirectoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for GlobalCompanyDirectory.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__GlobalCompanyDirectoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the GlobalCompanyDirectory model
   */
  interface GlobalCompanyDirectoryFieldRefs {
    readonly id: FieldRef<"GlobalCompanyDirectory", 'String'>
    readonly taxId: FieldRef<"GlobalCompanyDirectory", 'String'>
    readonly name: FieldRef<"GlobalCompanyDirectory", 'String'>
    readonly legalForm: FieldRef<"GlobalCompanyDirectory", 'CounterpartyLegalForm'>
    readonly legalAddress: FieldRef<"GlobalCompanyDirectory", 'String'>
    readonly phone: FieldRef<"GlobalCompanyDirectory", 'String'>
    readonly directorName: FieldRef<"GlobalCompanyDirectory", 'String'>
    readonly createdAt: FieldRef<"GlobalCompanyDirectory", 'DateTime'>
    readonly updatedAt: FieldRef<"GlobalCompanyDirectory", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * GlobalCompanyDirectory findUnique
   */
  export type GlobalCompanyDirectoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * Filter, which GlobalCompanyDirectory to fetch.
     */
    where: GlobalCompanyDirectoryWhereUniqueInput
  }

  /**
   * GlobalCompanyDirectory findUniqueOrThrow
   */
  export type GlobalCompanyDirectoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * Filter, which GlobalCompanyDirectory to fetch.
     */
    where: GlobalCompanyDirectoryWhereUniqueInput
  }

  /**
   * GlobalCompanyDirectory findFirst
   */
  export type GlobalCompanyDirectoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * Filter, which GlobalCompanyDirectory to fetch.
     */
    where?: GlobalCompanyDirectoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalCompanyDirectories to fetch.
     */
    orderBy?: GlobalCompanyDirectoryOrderByWithRelationInput | GlobalCompanyDirectoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GlobalCompanyDirectories.
     */
    cursor?: GlobalCompanyDirectoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalCompanyDirectories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalCompanyDirectories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalCompanyDirectories.
     */
    distinct?: GlobalCompanyDirectoryScalarFieldEnum | GlobalCompanyDirectoryScalarFieldEnum[]
  }

  /**
   * GlobalCompanyDirectory findFirstOrThrow
   */
  export type GlobalCompanyDirectoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * Filter, which GlobalCompanyDirectory to fetch.
     */
    where?: GlobalCompanyDirectoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalCompanyDirectories to fetch.
     */
    orderBy?: GlobalCompanyDirectoryOrderByWithRelationInput | GlobalCompanyDirectoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GlobalCompanyDirectories.
     */
    cursor?: GlobalCompanyDirectoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalCompanyDirectories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalCompanyDirectories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalCompanyDirectories.
     */
    distinct?: GlobalCompanyDirectoryScalarFieldEnum | GlobalCompanyDirectoryScalarFieldEnum[]
  }

  /**
   * GlobalCompanyDirectory findMany
   */
  export type GlobalCompanyDirectoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * Filter, which GlobalCompanyDirectories to fetch.
     */
    where?: GlobalCompanyDirectoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalCompanyDirectories to fetch.
     */
    orderBy?: GlobalCompanyDirectoryOrderByWithRelationInput | GlobalCompanyDirectoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing GlobalCompanyDirectories.
     */
    cursor?: GlobalCompanyDirectoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalCompanyDirectories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalCompanyDirectories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalCompanyDirectories.
     */
    distinct?: GlobalCompanyDirectoryScalarFieldEnum | GlobalCompanyDirectoryScalarFieldEnum[]
  }

  /**
   * GlobalCompanyDirectory create
   */
  export type GlobalCompanyDirectoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * The data needed to create a GlobalCompanyDirectory.
     */
    data: XOR<GlobalCompanyDirectoryCreateInput, GlobalCompanyDirectoryUncheckedCreateInput>
  }

  /**
   * GlobalCompanyDirectory createMany
   */
  export type GlobalCompanyDirectoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many GlobalCompanyDirectories.
     */
    data: GlobalCompanyDirectoryCreateManyInput | GlobalCompanyDirectoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GlobalCompanyDirectory createManyAndReturn
   */
  export type GlobalCompanyDirectoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * The data used to create many GlobalCompanyDirectories.
     */
    data: GlobalCompanyDirectoryCreateManyInput | GlobalCompanyDirectoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GlobalCompanyDirectory update
   */
  export type GlobalCompanyDirectoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * The data needed to update a GlobalCompanyDirectory.
     */
    data: XOR<GlobalCompanyDirectoryUpdateInput, GlobalCompanyDirectoryUncheckedUpdateInput>
    /**
     * Choose, which GlobalCompanyDirectory to update.
     */
    where: GlobalCompanyDirectoryWhereUniqueInput
  }

  /**
   * GlobalCompanyDirectory updateMany
   */
  export type GlobalCompanyDirectoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update GlobalCompanyDirectories.
     */
    data: XOR<GlobalCompanyDirectoryUpdateManyMutationInput, GlobalCompanyDirectoryUncheckedUpdateManyInput>
    /**
     * Filter which GlobalCompanyDirectories to update
     */
    where?: GlobalCompanyDirectoryWhereInput
    /**
     * Limit how many GlobalCompanyDirectories to update.
     */
    limit?: number
  }

  /**
   * GlobalCompanyDirectory updateManyAndReturn
   */
  export type GlobalCompanyDirectoryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * The data used to update GlobalCompanyDirectories.
     */
    data: XOR<GlobalCompanyDirectoryUpdateManyMutationInput, GlobalCompanyDirectoryUncheckedUpdateManyInput>
    /**
     * Filter which GlobalCompanyDirectories to update
     */
    where?: GlobalCompanyDirectoryWhereInput
    /**
     * Limit how many GlobalCompanyDirectories to update.
     */
    limit?: number
  }

  /**
   * GlobalCompanyDirectory upsert
   */
  export type GlobalCompanyDirectoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * The filter to search for the GlobalCompanyDirectory to update in case it exists.
     */
    where: GlobalCompanyDirectoryWhereUniqueInput
    /**
     * In case the GlobalCompanyDirectory found by the `where` argument doesn't exist, create a new GlobalCompanyDirectory with this data.
     */
    create: XOR<GlobalCompanyDirectoryCreateInput, GlobalCompanyDirectoryUncheckedCreateInput>
    /**
     * In case the GlobalCompanyDirectory was found with the provided `where` argument, update it with this data.
     */
    update: XOR<GlobalCompanyDirectoryUpdateInput, GlobalCompanyDirectoryUncheckedUpdateInput>
  }

  /**
   * GlobalCompanyDirectory delete
   */
  export type GlobalCompanyDirectoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
    /**
     * Filter which GlobalCompanyDirectory to delete.
     */
    where: GlobalCompanyDirectoryWhereUniqueInput
  }

  /**
   * GlobalCompanyDirectory deleteMany
   */
  export type GlobalCompanyDirectoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GlobalCompanyDirectories to delete
     */
    where?: GlobalCompanyDirectoryWhereInput
    /**
     * Limit how many GlobalCompanyDirectories to delete.
     */
    limit?: number
  }

  /**
   * GlobalCompanyDirectory without action
   */
  export type GlobalCompanyDirectoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalCompanyDirectory
     */
    select?: GlobalCompanyDirectorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalCompanyDirectory
     */
    omit?: GlobalCompanyDirectoryOmit<ExtArgs> | null
  }


  /**
   * Model BankGlossary
   */

  export type AggregateBankGlossary = {
    _count: BankGlossaryCountAggregateOutputType | null
    _min: BankGlossaryMinAggregateOutputType | null
    _max: BankGlossaryMaxAggregateOutputType | null
  }

  export type BankGlossaryMinAggregateOutputType = {
    id: string | null
    nameAz: string | null
    voen: string | null
    code: string | null
    correspondentIban: string | null
    swift: string | null
    headAddress: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BankGlossaryMaxAggregateOutputType = {
    id: string | null
    nameAz: string | null
    voen: string | null
    code: string | null
    correspondentIban: string | null
    swift: string | null
    headAddress: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BankGlossaryCountAggregateOutputType = {
    id: number
    nameAz: number
    voen: number
    code: number
    correspondentIban: number
    swift: number
    headPhones: number
    headAddress: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type BankGlossaryMinAggregateInputType = {
    id?: true
    nameAz?: true
    voen?: true
    code?: true
    correspondentIban?: true
    swift?: true
    headAddress?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BankGlossaryMaxAggregateInputType = {
    id?: true
    nameAz?: true
    voen?: true
    code?: true
    correspondentIban?: true
    swift?: true
    headAddress?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BankGlossaryCountAggregateInputType = {
    id?: true
    nameAz?: true
    voen?: true
    code?: true
    correspondentIban?: true
    swift?: true
    headPhones?: true
    headAddress?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type BankGlossaryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which BankGlossary to aggregate.
     */
    where?: BankGlossaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BankGlossaries to fetch.
     */
    orderBy?: BankGlossaryOrderByWithRelationInput | BankGlossaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: BankGlossaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BankGlossaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BankGlossaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned BankGlossaries
    **/
    _count?: true | BankGlossaryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: BankGlossaryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: BankGlossaryMaxAggregateInputType
  }

  export type GetBankGlossaryAggregateType<T extends BankGlossaryAggregateArgs> = {
        [P in keyof T & keyof AggregateBankGlossary]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBankGlossary[P]>
      : GetScalarType<T[P], AggregateBankGlossary[P]>
  }




  export type BankGlossaryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BankGlossaryWhereInput
    orderBy?: BankGlossaryOrderByWithAggregationInput | BankGlossaryOrderByWithAggregationInput[]
    by: BankGlossaryScalarFieldEnum[] | BankGlossaryScalarFieldEnum
    having?: BankGlossaryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: BankGlossaryCountAggregateInputType | true
    _min?: BankGlossaryMinAggregateInputType
    _max?: BankGlossaryMaxAggregateInputType
  }

  export type BankGlossaryGroupByOutputType = {
    id: string
    nameAz: string
    voen: string
    code: string
    correspondentIban: string | null
    swift: string | null
    headPhones: string[]
    headAddress: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: BankGlossaryCountAggregateOutputType | null
    _min: BankGlossaryMinAggregateOutputType | null
    _max: BankGlossaryMaxAggregateOutputType | null
  }

  type GetBankGlossaryGroupByPayload<T extends BankGlossaryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<BankGlossaryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof BankGlossaryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], BankGlossaryGroupByOutputType[P]>
            : GetScalarType<T[P], BankGlossaryGroupByOutputType[P]>
        }
      >
    >


  export type BankGlossarySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nameAz?: boolean
    voen?: boolean
    code?: boolean
    correspondentIban?: boolean
    swift?: boolean
    headPhones?: boolean
    headAddress?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    branches?: boolean | BankGlossary$branchesArgs<ExtArgs>
    _count?: boolean | BankGlossaryCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["bankGlossary"]>

  export type BankGlossarySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nameAz?: boolean
    voen?: boolean
    code?: boolean
    correspondentIban?: boolean
    swift?: boolean
    headPhones?: boolean
    headAddress?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["bankGlossary"]>

  export type BankGlossarySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nameAz?: boolean
    voen?: boolean
    code?: boolean
    correspondentIban?: boolean
    swift?: boolean
    headPhones?: boolean
    headAddress?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["bankGlossary"]>

  export type BankGlossarySelectScalar = {
    id?: boolean
    nameAz?: boolean
    voen?: boolean
    code?: boolean
    correspondentIban?: boolean
    swift?: boolean
    headPhones?: boolean
    headAddress?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type BankGlossaryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "nameAz" | "voen" | "code" | "correspondentIban" | "swift" | "headPhones" | "headAddress" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["bankGlossary"]>
  export type BankGlossaryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    branches?: boolean | BankGlossary$branchesArgs<ExtArgs>
    _count?: boolean | BankGlossaryCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type BankGlossaryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type BankGlossaryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $BankGlossaryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "BankGlossary"
    objects: {
      branches: Prisma.$BankBranchPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      nameAz: string
      voen: string
      code: string
      correspondentIban: string | null
      swift: string | null
      headPhones: string[]
      headAddress: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["bankGlossary"]>
    composites: {}
  }

  type BankGlossaryGetPayload<S extends boolean | null | undefined | BankGlossaryDefaultArgs> = $Result.GetResult<Prisma.$BankGlossaryPayload, S>

  type BankGlossaryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<BankGlossaryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: BankGlossaryCountAggregateInputType | true
    }

  export interface BankGlossaryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['BankGlossary'], meta: { name: 'BankGlossary' } }
    /**
     * Find zero or one BankGlossary that matches the filter.
     * @param {BankGlossaryFindUniqueArgs} args - Arguments to find a BankGlossary
     * @example
     * // Get one BankGlossary
     * const bankGlossary = await prisma.bankGlossary.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends BankGlossaryFindUniqueArgs>(args: SelectSubset<T, BankGlossaryFindUniqueArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one BankGlossary that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {BankGlossaryFindUniqueOrThrowArgs} args - Arguments to find a BankGlossary
     * @example
     * // Get one BankGlossary
     * const bankGlossary = await prisma.bankGlossary.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends BankGlossaryFindUniqueOrThrowArgs>(args: SelectSubset<T, BankGlossaryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first BankGlossary that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankGlossaryFindFirstArgs} args - Arguments to find a BankGlossary
     * @example
     * // Get one BankGlossary
     * const bankGlossary = await prisma.bankGlossary.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends BankGlossaryFindFirstArgs>(args?: SelectSubset<T, BankGlossaryFindFirstArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first BankGlossary that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankGlossaryFindFirstOrThrowArgs} args - Arguments to find a BankGlossary
     * @example
     * // Get one BankGlossary
     * const bankGlossary = await prisma.bankGlossary.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends BankGlossaryFindFirstOrThrowArgs>(args?: SelectSubset<T, BankGlossaryFindFirstOrThrowArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more BankGlossaries that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankGlossaryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all BankGlossaries
     * const bankGlossaries = await prisma.bankGlossary.findMany()
     * 
     * // Get first 10 BankGlossaries
     * const bankGlossaries = await prisma.bankGlossary.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const bankGlossaryWithIdOnly = await prisma.bankGlossary.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends BankGlossaryFindManyArgs>(args?: SelectSubset<T, BankGlossaryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a BankGlossary.
     * @param {BankGlossaryCreateArgs} args - Arguments to create a BankGlossary.
     * @example
     * // Create one BankGlossary
     * const BankGlossary = await prisma.bankGlossary.create({
     *   data: {
     *     // ... data to create a BankGlossary
     *   }
     * })
     * 
     */
    create<T extends BankGlossaryCreateArgs>(args: SelectSubset<T, BankGlossaryCreateArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many BankGlossaries.
     * @param {BankGlossaryCreateManyArgs} args - Arguments to create many BankGlossaries.
     * @example
     * // Create many BankGlossaries
     * const bankGlossary = await prisma.bankGlossary.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends BankGlossaryCreateManyArgs>(args?: SelectSubset<T, BankGlossaryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many BankGlossaries and returns the data saved in the database.
     * @param {BankGlossaryCreateManyAndReturnArgs} args - Arguments to create many BankGlossaries.
     * @example
     * // Create many BankGlossaries
     * const bankGlossary = await prisma.bankGlossary.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many BankGlossaries and only return the `id`
     * const bankGlossaryWithIdOnly = await prisma.bankGlossary.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends BankGlossaryCreateManyAndReturnArgs>(args?: SelectSubset<T, BankGlossaryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a BankGlossary.
     * @param {BankGlossaryDeleteArgs} args - Arguments to delete one BankGlossary.
     * @example
     * // Delete one BankGlossary
     * const BankGlossary = await prisma.bankGlossary.delete({
     *   where: {
     *     // ... filter to delete one BankGlossary
     *   }
     * })
     * 
     */
    delete<T extends BankGlossaryDeleteArgs>(args: SelectSubset<T, BankGlossaryDeleteArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one BankGlossary.
     * @param {BankGlossaryUpdateArgs} args - Arguments to update one BankGlossary.
     * @example
     * // Update one BankGlossary
     * const bankGlossary = await prisma.bankGlossary.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends BankGlossaryUpdateArgs>(args: SelectSubset<T, BankGlossaryUpdateArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more BankGlossaries.
     * @param {BankGlossaryDeleteManyArgs} args - Arguments to filter BankGlossaries to delete.
     * @example
     * // Delete a few BankGlossaries
     * const { count } = await prisma.bankGlossary.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends BankGlossaryDeleteManyArgs>(args?: SelectSubset<T, BankGlossaryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more BankGlossaries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankGlossaryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many BankGlossaries
     * const bankGlossary = await prisma.bankGlossary.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends BankGlossaryUpdateManyArgs>(args: SelectSubset<T, BankGlossaryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more BankGlossaries and returns the data updated in the database.
     * @param {BankGlossaryUpdateManyAndReturnArgs} args - Arguments to update many BankGlossaries.
     * @example
     * // Update many BankGlossaries
     * const bankGlossary = await prisma.bankGlossary.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more BankGlossaries and only return the `id`
     * const bankGlossaryWithIdOnly = await prisma.bankGlossary.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends BankGlossaryUpdateManyAndReturnArgs>(args: SelectSubset<T, BankGlossaryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one BankGlossary.
     * @param {BankGlossaryUpsertArgs} args - Arguments to update or create a BankGlossary.
     * @example
     * // Update or create a BankGlossary
     * const bankGlossary = await prisma.bankGlossary.upsert({
     *   create: {
     *     // ... data to create a BankGlossary
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the BankGlossary we want to update
     *   }
     * })
     */
    upsert<T extends BankGlossaryUpsertArgs>(args: SelectSubset<T, BankGlossaryUpsertArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of BankGlossaries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankGlossaryCountArgs} args - Arguments to filter BankGlossaries to count.
     * @example
     * // Count the number of BankGlossaries
     * const count = await prisma.bankGlossary.count({
     *   where: {
     *     // ... the filter for the BankGlossaries we want to count
     *   }
     * })
    **/
    count<T extends BankGlossaryCountArgs>(
      args?: Subset<T, BankGlossaryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], BankGlossaryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a BankGlossary.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankGlossaryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends BankGlossaryAggregateArgs>(args: Subset<T, BankGlossaryAggregateArgs>): Prisma.PrismaPromise<GetBankGlossaryAggregateType<T>>

    /**
     * Group by BankGlossary.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankGlossaryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends BankGlossaryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: BankGlossaryGroupByArgs['orderBy'] }
        : { orderBy?: BankGlossaryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, BankGlossaryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBankGlossaryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the BankGlossary model
   */
  readonly fields: BankGlossaryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for BankGlossary.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__BankGlossaryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    branches<T extends BankGlossary$branchesArgs<ExtArgs> = {}>(args?: Subset<T, BankGlossary$branchesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the BankGlossary model
   */
  interface BankGlossaryFieldRefs {
    readonly id: FieldRef<"BankGlossary", 'String'>
    readonly nameAz: FieldRef<"BankGlossary", 'String'>
    readonly voen: FieldRef<"BankGlossary", 'String'>
    readonly code: FieldRef<"BankGlossary", 'String'>
    readonly correspondentIban: FieldRef<"BankGlossary", 'String'>
    readonly swift: FieldRef<"BankGlossary", 'String'>
    readonly headPhones: FieldRef<"BankGlossary", 'String[]'>
    readonly headAddress: FieldRef<"BankGlossary", 'String'>
    readonly isActive: FieldRef<"BankGlossary", 'Boolean'>
    readonly createdAt: FieldRef<"BankGlossary", 'DateTime'>
    readonly updatedAt: FieldRef<"BankGlossary", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * BankGlossary findUnique
   */
  export type BankGlossaryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * Filter, which BankGlossary to fetch.
     */
    where: BankGlossaryWhereUniqueInput
  }

  /**
   * BankGlossary findUniqueOrThrow
   */
  export type BankGlossaryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * Filter, which BankGlossary to fetch.
     */
    where: BankGlossaryWhereUniqueInput
  }

  /**
   * BankGlossary findFirst
   */
  export type BankGlossaryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * Filter, which BankGlossary to fetch.
     */
    where?: BankGlossaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BankGlossaries to fetch.
     */
    orderBy?: BankGlossaryOrderByWithRelationInput | BankGlossaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for BankGlossaries.
     */
    cursor?: BankGlossaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BankGlossaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BankGlossaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BankGlossaries.
     */
    distinct?: BankGlossaryScalarFieldEnum | BankGlossaryScalarFieldEnum[]
  }

  /**
   * BankGlossary findFirstOrThrow
   */
  export type BankGlossaryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * Filter, which BankGlossary to fetch.
     */
    where?: BankGlossaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BankGlossaries to fetch.
     */
    orderBy?: BankGlossaryOrderByWithRelationInput | BankGlossaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for BankGlossaries.
     */
    cursor?: BankGlossaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BankGlossaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BankGlossaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BankGlossaries.
     */
    distinct?: BankGlossaryScalarFieldEnum | BankGlossaryScalarFieldEnum[]
  }

  /**
   * BankGlossary findMany
   */
  export type BankGlossaryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * Filter, which BankGlossaries to fetch.
     */
    where?: BankGlossaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BankGlossaries to fetch.
     */
    orderBy?: BankGlossaryOrderByWithRelationInput | BankGlossaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing BankGlossaries.
     */
    cursor?: BankGlossaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BankGlossaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BankGlossaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BankGlossaries.
     */
    distinct?: BankGlossaryScalarFieldEnum | BankGlossaryScalarFieldEnum[]
  }

  /**
   * BankGlossary create
   */
  export type BankGlossaryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * The data needed to create a BankGlossary.
     */
    data: XOR<BankGlossaryCreateInput, BankGlossaryUncheckedCreateInput>
  }

  /**
   * BankGlossary createMany
   */
  export type BankGlossaryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many BankGlossaries.
     */
    data: BankGlossaryCreateManyInput | BankGlossaryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * BankGlossary createManyAndReturn
   */
  export type BankGlossaryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * The data used to create many BankGlossaries.
     */
    data: BankGlossaryCreateManyInput | BankGlossaryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * BankGlossary update
   */
  export type BankGlossaryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * The data needed to update a BankGlossary.
     */
    data: XOR<BankGlossaryUpdateInput, BankGlossaryUncheckedUpdateInput>
    /**
     * Choose, which BankGlossary to update.
     */
    where: BankGlossaryWhereUniqueInput
  }

  /**
   * BankGlossary updateMany
   */
  export type BankGlossaryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update BankGlossaries.
     */
    data: XOR<BankGlossaryUpdateManyMutationInput, BankGlossaryUncheckedUpdateManyInput>
    /**
     * Filter which BankGlossaries to update
     */
    where?: BankGlossaryWhereInput
    /**
     * Limit how many BankGlossaries to update.
     */
    limit?: number
  }

  /**
   * BankGlossary updateManyAndReturn
   */
  export type BankGlossaryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * The data used to update BankGlossaries.
     */
    data: XOR<BankGlossaryUpdateManyMutationInput, BankGlossaryUncheckedUpdateManyInput>
    /**
     * Filter which BankGlossaries to update
     */
    where?: BankGlossaryWhereInput
    /**
     * Limit how many BankGlossaries to update.
     */
    limit?: number
  }

  /**
   * BankGlossary upsert
   */
  export type BankGlossaryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * The filter to search for the BankGlossary to update in case it exists.
     */
    where: BankGlossaryWhereUniqueInput
    /**
     * In case the BankGlossary found by the `where` argument doesn't exist, create a new BankGlossary with this data.
     */
    create: XOR<BankGlossaryCreateInput, BankGlossaryUncheckedCreateInput>
    /**
     * In case the BankGlossary was found with the provided `where` argument, update it with this data.
     */
    update: XOR<BankGlossaryUpdateInput, BankGlossaryUncheckedUpdateInput>
  }

  /**
   * BankGlossary delete
   */
  export type BankGlossaryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
    /**
     * Filter which BankGlossary to delete.
     */
    where: BankGlossaryWhereUniqueInput
  }

  /**
   * BankGlossary deleteMany
   */
  export type BankGlossaryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which BankGlossaries to delete
     */
    where?: BankGlossaryWhereInput
    /**
     * Limit how many BankGlossaries to delete.
     */
    limit?: number
  }

  /**
   * BankGlossary.branches
   */
  export type BankGlossary$branchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    where?: BankBranchWhereInput
    orderBy?: BankBranchOrderByWithRelationInput | BankBranchOrderByWithRelationInput[]
    cursor?: BankBranchWhereUniqueInput
    take?: number
    skip?: number
    distinct?: BankBranchScalarFieldEnum | BankBranchScalarFieldEnum[]
  }

  /**
   * BankGlossary without action
   */
  export type BankGlossaryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankGlossary
     */
    select?: BankGlossarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankGlossary
     */
    omit?: BankGlossaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankGlossaryInclude<ExtArgs> | null
  }


  /**
   * Model BankBranch
   */

  export type AggregateBankBranch = {
    _count: BankBranchCountAggregateOutputType | null
    _min: BankBranchMinAggregateOutputType | null
    _max: BankBranchMaxAggregateOutputType | null
  }

  export type BankBranchMinAggregateOutputType = {
    id: string | null
    bankId: string | null
    branchCode: string | null
    name: string | null
    swift: string | null
    address: string | null
    isHeadOffice: boolean | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BankBranchMaxAggregateOutputType = {
    id: string | null
    bankId: string | null
    branchCode: string | null
    name: string | null
    swift: string | null
    address: string | null
    isHeadOffice: boolean | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BankBranchCountAggregateOutputType = {
    id: number
    bankId: number
    branchCode: number
    name: number
    swift: number
    address: number
    phones: number
    isHeadOffice: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type BankBranchMinAggregateInputType = {
    id?: true
    bankId?: true
    branchCode?: true
    name?: true
    swift?: true
    address?: true
    isHeadOffice?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BankBranchMaxAggregateInputType = {
    id?: true
    bankId?: true
    branchCode?: true
    name?: true
    swift?: true
    address?: true
    isHeadOffice?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BankBranchCountAggregateInputType = {
    id?: true
    bankId?: true
    branchCode?: true
    name?: true
    swift?: true
    address?: true
    phones?: true
    isHeadOffice?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type BankBranchAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which BankBranch to aggregate.
     */
    where?: BankBranchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BankBranches to fetch.
     */
    orderBy?: BankBranchOrderByWithRelationInput | BankBranchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: BankBranchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BankBranches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BankBranches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned BankBranches
    **/
    _count?: true | BankBranchCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: BankBranchMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: BankBranchMaxAggregateInputType
  }

  export type GetBankBranchAggregateType<T extends BankBranchAggregateArgs> = {
        [P in keyof T & keyof AggregateBankBranch]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBankBranch[P]>
      : GetScalarType<T[P], AggregateBankBranch[P]>
  }




  export type BankBranchGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BankBranchWhereInput
    orderBy?: BankBranchOrderByWithAggregationInput | BankBranchOrderByWithAggregationInput[]
    by: BankBranchScalarFieldEnum[] | BankBranchScalarFieldEnum
    having?: BankBranchScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: BankBranchCountAggregateInputType | true
    _min?: BankBranchMinAggregateInputType
    _max?: BankBranchMaxAggregateInputType
  }

  export type BankBranchGroupByOutputType = {
    id: string
    bankId: string
    branchCode: string
    name: string
    swift: string | null
    address: string | null
    phones: string[]
    isHeadOffice: boolean
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: BankBranchCountAggregateOutputType | null
    _min: BankBranchMinAggregateOutputType | null
    _max: BankBranchMaxAggregateOutputType | null
  }

  type GetBankBranchGroupByPayload<T extends BankBranchGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<BankBranchGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof BankBranchGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], BankBranchGroupByOutputType[P]>
            : GetScalarType<T[P], BankBranchGroupByOutputType[P]>
        }
      >
    >


  export type BankBranchSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bankId?: boolean
    branchCode?: boolean
    name?: boolean
    swift?: boolean
    address?: boolean
    phones?: boolean
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    bank?: boolean | BankGlossaryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["bankBranch"]>

  export type BankBranchSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bankId?: boolean
    branchCode?: boolean
    name?: boolean
    swift?: boolean
    address?: boolean
    phones?: boolean
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    bank?: boolean | BankGlossaryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["bankBranch"]>

  export type BankBranchSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bankId?: boolean
    branchCode?: boolean
    name?: boolean
    swift?: boolean
    address?: boolean
    phones?: boolean
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    bank?: boolean | BankGlossaryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["bankBranch"]>

  export type BankBranchSelectScalar = {
    id?: boolean
    bankId?: boolean
    branchCode?: boolean
    name?: boolean
    swift?: boolean
    address?: boolean
    phones?: boolean
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type BankBranchOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "bankId" | "branchCode" | "name" | "swift" | "address" | "phones" | "isHeadOffice" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["bankBranch"]>
  export type BankBranchInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    bank?: boolean | BankGlossaryDefaultArgs<ExtArgs>
  }
  export type BankBranchIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    bank?: boolean | BankGlossaryDefaultArgs<ExtArgs>
  }
  export type BankBranchIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    bank?: boolean | BankGlossaryDefaultArgs<ExtArgs>
  }

  export type $BankBranchPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "BankBranch"
    objects: {
      bank: Prisma.$BankGlossaryPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bankId: string
      branchCode: string
      name: string
      swift: string | null
      address: string | null
      phones: string[]
      isHeadOffice: boolean
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["bankBranch"]>
    composites: {}
  }

  type BankBranchGetPayload<S extends boolean | null | undefined | BankBranchDefaultArgs> = $Result.GetResult<Prisma.$BankBranchPayload, S>

  type BankBranchCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<BankBranchFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: BankBranchCountAggregateInputType | true
    }

  export interface BankBranchDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['BankBranch'], meta: { name: 'BankBranch' } }
    /**
     * Find zero or one BankBranch that matches the filter.
     * @param {BankBranchFindUniqueArgs} args - Arguments to find a BankBranch
     * @example
     * // Get one BankBranch
     * const bankBranch = await prisma.bankBranch.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends BankBranchFindUniqueArgs>(args: SelectSubset<T, BankBranchFindUniqueArgs<ExtArgs>>): Prisma__BankBranchClient<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one BankBranch that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {BankBranchFindUniqueOrThrowArgs} args - Arguments to find a BankBranch
     * @example
     * // Get one BankBranch
     * const bankBranch = await prisma.bankBranch.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends BankBranchFindUniqueOrThrowArgs>(args: SelectSubset<T, BankBranchFindUniqueOrThrowArgs<ExtArgs>>): Prisma__BankBranchClient<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first BankBranch that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankBranchFindFirstArgs} args - Arguments to find a BankBranch
     * @example
     * // Get one BankBranch
     * const bankBranch = await prisma.bankBranch.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends BankBranchFindFirstArgs>(args?: SelectSubset<T, BankBranchFindFirstArgs<ExtArgs>>): Prisma__BankBranchClient<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first BankBranch that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankBranchFindFirstOrThrowArgs} args - Arguments to find a BankBranch
     * @example
     * // Get one BankBranch
     * const bankBranch = await prisma.bankBranch.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends BankBranchFindFirstOrThrowArgs>(args?: SelectSubset<T, BankBranchFindFirstOrThrowArgs<ExtArgs>>): Prisma__BankBranchClient<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more BankBranches that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankBranchFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all BankBranches
     * const bankBranches = await prisma.bankBranch.findMany()
     * 
     * // Get first 10 BankBranches
     * const bankBranches = await prisma.bankBranch.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const bankBranchWithIdOnly = await prisma.bankBranch.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends BankBranchFindManyArgs>(args?: SelectSubset<T, BankBranchFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a BankBranch.
     * @param {BankBranchCreateArgs} args - Arguments to create a BankBranch.
     * @example
     * // Create one BankBranch
     * const BankBranch = await prisma.bankBranch.create({
     *   data: {
     *     // ... data to create a BankBranch
     *   }
     * })
     * 
     */
    create<T extends BankBranchCreateArgs>(args: SelectSubset<T, BankBranchCreateArgs<ExtArgs>>): Prisma__BankBranchClient<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many BankBranches.
     * @param {BankBranchCreateManyArgs} args - Arguments to create many BankBranches.
     * @example
     * // Create many BankBranches
     * const bankBranch = await prisma.bankBranch.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends BankBranchCreateManyArgs>(args?: SelectSubset<T, BankBranchCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many BankBranches and returns the data saved in the database.
     * @param {BankBranchCreateManyAndReturnArgs} args - Arguments to create many BankBranches.
     * @example
     * // Create many BankBranches
     * const bankBranch = await prisma.bankBranch.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many BankBranches and only return the `id`
     * const bankBranchWithIdOnly = await prisma.bankBranch.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends BankBranchCreateManyAndReturnArgs>(args?: SelectSubset<T, BankBranchCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a BankBranch.
     * @param {BankBranchDeleteArgs} args - Arguments to delete one BankBranch.
     * @example
     * // Delete one BankBranch
     * const BankBranch = await prisma.bankBranch.delete({
     *   where: {
     *     // ... filter to delete one BankBranch
     *   }
     * })
     * 
     */
    delete<T extends BankBranchDeleteArgs>(args: SelectSubset<T, BankBranchDeleteArgs<ExtArgs>>): Prisma__BankBranchClient<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one BankBranch.
     * @param {BankBranchUpdateArgs} args - Arguments to update one BankBranch.
     * @example
     * // Update one BankBranch
     * const bankBranch = await prisma.bankBranch.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends BankBranchUpdateArgs>(args: SelectSubset<T, BankBranchUpdateArgs<ExtArgs>>): Prisma__BankBranchClient<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more BankBranches.
     * @param {BankBranchDeleteManyArgs} args - Arguments to filter BankBranches to delete.
     * @example
     * // Delete a few BankBranches
     * const { count } = await prisma.bankBranch.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends BankBranchDeleteManyArgs>(args?: SelectSubset<T, BankBranchDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more BankBranches.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankBranchUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many BankBranches
     * const bankBranch = await prisma.bankBranch.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends BankBranchUpdateManyArgs>(args: SelectSubset<T, BankBranchUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more BankBranches and returns the data updated in the database.
     * @param {BankBranchUpdateManyAndReturnArgs} args - Arguments to update many BankBranches.
     * @example
     * // Update many BankBranches
     * const bankBranch = await prisma.bankBranch.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more BankBranches and only return the `id`
     * const bankBranchWithIdOnly = await prisma.bankBranch.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends BankBranchUpdateManyAndReturnArgs>(args: SelectSubset<T, BankBranchUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one BankBranch.
     * @param {BankBranchUpsertArgs} args - Arguments to update or create a BankBranch.
     * @example
     * // Update or create a BankBranch
     * const bankBranch = await prisma.bankBranch.upsert({
     *   create: {
     *     // ... data to create a BankBranch
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the BankBranch we want to update
     *   }
     * })
     */
    upsert<T extends BankBranchUpsertArgs>(args: SelectSubset<T, BankBranchUpsertArgs<ExtArgs>>): Prisma__BankBranchClient<$Result.GetResult<Prisma.$BankBranchPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of BankBranches.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankBranchCountArgs} args - Arguments to filter BankBranches to count.
     * @example
     * // Count the number of BankBranches
     * const count = await prisma.bankBranch.count({
     *   where: {
     *     // ... the filter for the BankBranches we want to count
     *   }
     * })
    **/
    count<T extends BankBranchCountArgs>(
      args?: Subset<T, BankBranchCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], BankBranchCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a BankBranch.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankBranchAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends BankBranchAggregateArgs>(args: Subset<T, BankBranchAggregateArgs>): Prisma.PrismaPromise<GetBankBranchAggregateType<T>>

    /**
     * Group by BankBranch.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BankBranchGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends BankBranchGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: BankBranchGroupByArgs['orderBy'] }
        : { orderBy?: BankBranchGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, BankBranchGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBankBranchGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the BankBranch model
   */
  readonly fields: BankBranchFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for BankBranch.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__BankBranchClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    bank<T extends BankGlossaryDefaultArgs<ExtArgs> = {}>(args?: Subset<T, BankGlossaryDefaultArgs<ExtArgs>>): Prisma__BankGlossaryClient<$Result.GetResult<Prisma.$BankGlossaryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the BankBranch model
   */
  interface BankBranchFieldRefs {
    readonly id: FieldRef<"BankBranch", 'String'>
    readonly bankId: FieldRef<"BankBranch", 'String'>
    readonly branchCode: FieldRef<"BankBranch", 'String'>
    readonly name: FieldRef<"BankBranch", 'String'>
    readonly swift: FieldRef<"BankBranch", 'String'>
    readonly address: FieldRef<"BankBranch", 'String'>
    readonly phones: FieldRef<"BankBranch", 'String[]'>
    readonly isHeadOffice: FieldRef<"BankBranch", 'Boolean'>
    readonly isActive: FieldRef<"BankBranch", 'Boolean'>
    readonly createdAt: FieldRef<"BankBranch", 'DateTime'>
    readonly updatedAt: FieldRef<"BankBranch", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * BankBranch findUnique
   */
  export type BankBranchFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * Filter, which BankBranch to fetch.
     */
    where: BankBranchWhereUniqueInput
  }

  /**
   * BankBranch findUniqueOrThrow
   */
  export type BankBranchFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * Filter, which BankBranch to fetch.
     */
    where: BankBranchWhereUniqueInput
  }

  /**
   * BankBranch findFirst
   */
  export type BankBranchFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * Filter, which BankBranch to fetch.
     */
    where?: BankBranchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BankBranches to fetch.
     */
    orderBy?: BankBranchOrderByWithRelationInput | BankBranchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for BankBranches.
     */
    cursor?: BankBranchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BankBranches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BankBranches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BankBranches.
     */
    distinct?: BankBranchScalarFieldEnum | BankBranchScalarFieldEnum[]
  }

  /**
   * BankBranch findFirstOrThrow
   */
  export type BankBranchFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * Filter, which BankBranch to fetch.
     */
    where?: BankBranchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BankBranches to fetch.
     */
    orderBy?: BankBranchOrderByWithRelationInput | BankBranchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for BankBranches.
     */
    cursor?: BankBranchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BankBranches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BankBranches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BankBranches.
     */
    distinct?: BankBranchScalarFieldEnum | BankBranchScalarFieldEnum[]
  }

  /**
   * BankBranch findMany
   */
  export type BankBranchFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * Filter, which BankBranches to fetch.
     */
    where?: BankBranchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BankBranches to fetch.
     */
    orderBy?: BankBranchOrderByWithRelationInput | BankBranchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing BankBranches.
     */
    cursor?: BankBranchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BankBranches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BankBranches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BankBranches.
     */
    distinct?: BankBranchScalarFieldEnum | BankBranchScalarFieldEnum[]
  }

  /**
   * BankBranch create
   */
  export type BankBranchCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * The data needed to create a BankBranch.
     */
    data: XOR<BankBranchCreateInput, BankBranchUncheckedCreateInput>
  }

  /**
   * BankBranch createMany
   */
  export type BankBranchCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many BankBranches.
     */
    data: BankBranchCreateManyInput | BankBranchCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * BankBranch createManyAndReturn
   */
  export type BankBranchCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * The data used to create many BankBranches.
     */
    data: BankBranchCreateManyInput | BankBranchCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * BankBranch update
   */
  export type BankBranchUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * The data needed to update a BankBranch.
     */
    data: XOR<BankBranchUpdateInput, BankBranchUncheckedUpdateInput>
    /**
     * Choose, which BankBranch to update.
     */
    where: BankBranchWhereUniqueInput
  }

  /**
   * BankBranch updateMany
   */
  export type BankBranchUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update BankBranches.
     */
    data: XOR<BankBranchUpdateManyMutationInput, BankBranchUncheckedUpdateManyInput>
    /**
     * Filter which BankBranches to update
     */
    where?: BankBranchWhereInput
    /**
     * Limit how many BankBranches to update.
     */
    limit?: number
  }

  /**
   * BankBranch updateManyAndReturn
   */
  export type BankBranchUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * The data used to update BankBranches.
     */
    data: XOR<BankBranchUpdateManyMutationInput, BankBranchUncheckedUpdateManyInput>
    /**
     * Filter which BankBranches to update
     */
    where?: BankBranchWhereInput
    /**
     * Limit how many BankBranches to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * BankBranch upsert
   */
  export type BankBranchUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * The filter to search for the BankBranch to update in case it exists.
     */
    where: BankBranchWhereUniqueInput
    /**
     * In case the BankBranch found by the `where` argument doesn't exist, create a new BankBranch with this data.
     */
    create: XOR<BankBranchCreateInput, BankBranchUncheckedCreateInput>
    /**
     * In case the BankBranch was found with the provided `where` argument, update it with this data.
     */
    update: XOR<BankBranchUpdateInput, BankBranchUncheckedUpdateInput>
  }

  /**
   * BankBranch delete
   */
  export type BankBranchDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
    /**
     * Filter which BankBranch to delete.
     */
    where: BankBranchWhereUniqueInput
  }

  /**
   * BankBranch deleteMany
   */
  export type BankBranchDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which BankBranches to delete
     */
    where?: BankBranchWhereInput
    /**
     * Limit how many BankBranches to delete.
     */
    limit?: number
  }

  /**
   * BankBranch without action
   */
  export type BankBranchDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BankBranch
     */
    select?: BankBranchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BankBranch
     */
    omit?: BankBranchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BankBranchInclude<ExtArgs> | null
  }


  /**
   * Model CustomsTariffRate
   */

  export type AggregateCustomsTariffRate = {
    _count: CustomsTariffRateCountAggregateOutputType | null
    _avg: CustomsTariffRateAvgAggregateOutputType | null
    _sum: CustomsTariffRateSumAggregateOutputType | null
    _min: CustomsTariffRateMinAggregateOutputType | null
    _max: CustomsTariffRateMaxAggregateOutputType | null
  }

  export type CustomsTariffRateAvgAggregateOutputType = {
    dutyRatePercent: Decimal | null
    vatRatePercent: Decimal | null
    excisePercent: Decimal | null
  }

  export type CustomsTariffRateSumAggregateOutputType = {
    dutyRatePercent: Decimal | null
    vatRatePercent: Decimal | null
    excisePercent: Decimal | null
  }

  export type CustomsTariffRateMinAggregateOutputType = {
    id: string | null
    hsCode: string | null
    description: string | null
    dutyRatePercent: Decimal | null
    vatRatePercent: Decimal | null
    excisePercent: Decimal | null
    effectiveFrom: Date | null
    effectiveTo: Date | null
    notes: string | null
    deletedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CustomsTariffRateMaxAggregateOutputType = {
    id: string | null
    hsCode: string | null
    description: string | null
    dutyRatePercent: Decimal | null
    vatRatePercent: Decimal | null
    excisePercent: Decimal | null
    effectiveFrom: Date | null
    effectiveTo: Date | null
    notes: string | null
    deletedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CustomsTariffRateCountAggregateOutputType = {
    id: number
    hsCode: number
    description: number
    dutyRatePercent: number
    vatRatePercent: number
    excisePercent: number
    effectiveFrom: number
    effectiveTo: number
    notes: number
    deletedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CustomsTariffRateAvgAggregateInputType = {
    dutyRatePercent?: true
    vatRatePercent?: true
    excisePercent?: true
  }

  export type CustomsTariffRateSumAggregateInputType = {
    dutyRatePercent?: true
    vatRatePercent?: true
    excisePercent?: true
  }

  export type CustomsTariffRateMinAggregateInputType = {
    id?: true
    hsCode?: true
    description?: true
    dutyRatePercent?: true
    vatRatePercent?: true
    excisePercent?: true
    effectiveFrom?: true
    effectiveTo?: true
    notes?: true
    deletedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CustomsTariffRateMaxAggregateInputType = {
    id?: true
    hsCode?: true
    description?: true
    dutyRatePercent?: true
    vatRatePercent?: true
    excisePercent?: true
    effectiveFrom?: true
    effectiveTo?: true
    notes?: true
    deletedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CustomsTariffRateCountAggregateInputType = {
    id?: true
    hsCode?: true
    description?: true
    dutyRatePercent?: true
    vatRatePercent?: true
    excisePercent?: true
    effectiveFrom?: true
    effectiveTo?: true
    notes?: true
    deletedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CustomsTariffRateAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomsTariffRate to aggregate.
     */
    where?: CustomsTariffRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomsTariffRates to fetch.
     */
    orderBy?: CustomsTariffRateOrderByWithRelationInput | CustomsTariffRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CustomsTariffRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomsTariffRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomsTariffRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CustomsTariffRates
    **/
    _count?: true | CustomsTariffRateCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CustomsTariffRateAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CustomsTariffRateSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CustomsTariffRateMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CustomsTariffRateMaxAggregateInputType
  }

  export type GetCustomsTariffRateAggregateType<T extends CustomsTariffRateAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomsTariffRate]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomsTariffRate[P]>
      : GetScalarType<T[P], AggregateCustomsTariffRate[P]>
  }




  export type CustomsTariffRateGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomsTariffRateWhereInput
    orderBy?: CustomsTariffRateOrderByWithAggregationInput | CustomsTariffRateOrderByWithAggregationInput[]
    by: CustomsTariffRateScalarFieldEnum[] | CustomsTariffRateScalarFieldEnum
    having?: CustomsTariffRateScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CustomsTariffRateCountAggregateInputType | true
    _avg?: CustomsTariffRateAvgAggregateInputType
    _sum?: CustomsTariffRateSumAggregateInputType
    _min?: CustomsTariffRateMinAggregateInputType
    _max?: CustomsTariffRateMaxAggregateInputType
  }

  export type CustomsTariffRateGroupByOutputType = {
    id: string
    hsCode: string
    description: string | null
    dutyRatePercent: Decimal
    vatRatePercent: Decimal
    excisePercent: Decimal
    effectiveFrom: Date
    effectiveTo: Date | null
    notes: string | null
    deletedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: CustomsTariffRateCountAggregateOutputType | null
    _avg: CustomsTariffRateAvgAggregateOutputType | null
    _sum: CustomsTariffRateSumAggregateOutputType | null
    _min: CustomsTariffRateMinAggregateOutputType | null
    _max: CustomsTariffRateMaxAggregateOutputType | null
  }

  type GetCustomsTariffRateGroupByPayload<T extends CustomsTariffRateGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CustomsTariffRateGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CustomsTariffRateGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CustomsTariffRateGroupByOutputType[P]>
            : GetScalarType<T[P], CustomsTariffRateGroupByOutputType[P]>
        }
      >
    >


  export type CustomsTariffRateSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    hsCode?: boolean
    description?: boolean
    dutyRatePercent?: boolean
    vatRatePercent?: boolean
    excisePercent?: boolean
    effectiveFrom?: boolean
    effectiveTo?: boolean
    notes?: boolean
    deletedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["customsTariffRate"]>

  export type CustomsTariffRateSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    hsCode?: boolean
    description?: boolean
    dutyRatePercent?: boolean
    vatRatePercent?: boolean
    excisePercent?: boolean
    effectiveFrom?: boolean
    effectiveTo?: boolean
    notes?: boolean
    deletedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["customsTariffRate"]>

  export type CustomsTariffRateSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    hsCode?: boolean
    description?: boolean
    dutyRatePercent?: boolean
    vatRatePercent?: boolean
    excisePercent?: boolean
    effectiveFrom?: boolean
    effectiveTo?: boolean
    notes?: boolean
    deletedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["customsTariffRate"]>

  export type CustomsTariffRateSelectScalar = {
    id?: boolean
    hsCode?: boolean
    description?: boolean
    dutyRatePercent?: boolean
    vatRatePercent?: boolean
    excisePercent?: boolean
    effectiveFrom?: boolean
    effectiveTo?: boolean
    notes?: boolean
    deletedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CustomsTariffRateOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "hsCode" | "description" | "dutyRatePercent" | "vatRatePercent" | "excisePercent" | "effectiveFrom" | "effectiveTo" | "notes" | "deletedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["customsTariffRate"]>

  export type $CustomsTariffRatePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CustomsTariffRate"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      hsCode: string
      description: string | null
      dutyRatePercent: Prisma.Decimal
      vatRatePercent: Prisma.Decimal
      excisePercent: Prisma.Decimal
      effectiveFrom: Date
      effectiveTo: Date | null
      notes: string | null
      deletedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["customsTariffRate"]>
    composites: {}
  }

  type CustomsTariffRateGetPayload<S extends boolean | null | undefined | CustomsTariffRateDefaultArgs> = $Result.GetResult<Prisma.$CustomsTariffRatePayload, S>

  type CustomsTariffRateCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CustomsTariffRateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CustomsTariffRateCountAggregateInputType | true
    }

  export interface CustomsTariffRateDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CustomsTariffRate'], meta: { name: 'CustomsTariffRate' } }
    /**
     * Find zero or one CustomsTariffRate that matches the filter.
     * @param {CustomsTariffRateFindUniqueArgs} args - Arguments to find a CustomsTariffRate
     * @example
     * // Get one CustomsTariffRate
     * const customsTariffRate = await prisma.customsTariffRate.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CustomsTariffRateFindUniqueArgs>(args: SelectSubset<T, CustomsTariffRateFindUniqueArgs<ExtArgs>>): Prisma__CustomsTariffRateClient<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CustomsTariffRate that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CustomsTariffRateFindUniqueOrThrowArgs} args - Arguments to find a CustomsTariffRate
     * @example
     * // Get one CustomsTariffRate
     * const customsTariffRate = await prisma.customsTariffRate.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CustomsTariffRateFindUniqueOrThrowArgs>(args: SelectSubset<T, CustomsTariffRateFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CustomsTariffRateClient<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomsTariffRate that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomsTariffRateFindFirstArgs} args - Arguments to find a CustomsTariffRate
     * @example
     * // Get one CustomsTariffRate
     * const customsTariffRate = await prisma.customsTariffRate.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CustomsTariffRateFindFirstArgs>(args?: SelectSubset<T, CustomsTariffRateFindFirstArgs<ExtArgs>>): Prisma__CustomsTariffRateClient<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomsTariffRate that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomsTariffRateFindFirstOrThrowArgs} args - Arguments to find a CustomsTariffRate
     * @example
     * // Get one CustomsTariffRate
     * const customsTariffRate = await prisma.customsTariffRate.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CustomsTariffRateFindFirstOrThrowArgs>(args?: SelectSubset<T, CustomsTariffRateFindFirstOrThrowArgs<ExtArgs>>): Prisma__CustomsTariffRateClient<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CustomsTariffRates that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomsTariffRateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CustomsTariffRates
     * const customsTariffRates = await prisma.customsTariffRate.findMany()
     * 
     * // Get first 10 CustomsTariffRates
     * const customsTariffRates = await prisma.customsTariffRate.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const customsTariffRateWithIdOnly = await prisma.customsTariffRate.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CustomsTariffRateFindManyArgs>(args?: SelectSubset<T, CustomsTariffRateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CustomsTariffRate.
     * @param {CustomsTariffRateCreateArgs} args - Arguments to create a CustomsTariffRate.
     * @example
     * // Create one CustomsTariffRate
     * const CustomsTariffRate = await prisma.customsTariffRate.create({
     *   data: {
     *     // ... data to create a CustomsTariffRate
     *   }
     * })
     * 
     */
    create<T extends CustomsTariffRateCreateArgs>(args: SelectSubset<T, CustomsTariffRateCreateArgs<ExtArgs>>): Prisma__CustomsTariffRateClient<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CustomsTariffRates.
     * @param {CustomsTariffRateCreateManyArgs} args - Arguments to create many CustomsTariffRates.
     * @example
     * // Create many CustomsTariffRates
     * const customsTariffRate = await prisma.customsTariffRate.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CustomsTariffRateCreateManyArgs>(args?: SelectSubset<T, CustomsTariffRateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CustomsTariffRates and returns the data saved in the database.
     * @param {CustomsTariffRateCreateManyAndReturnArgs} args - Arguments to create many CustomsTariffRates.
     * @example
     * // Create many CustomsTariffRates
     * const customsTariffRate = await prisma.customsTariffRate.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CustomsTariffRates and only return the `id`
     * const customsTariffRateWithIdOnly = await prisma.customsTariffRate.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CustomsTariffRateCreateManyAndReturnArgs>(args?: SelectSubset<T, CustomsTariffRateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CustomsTariffRate.
     * @param {CustomsTariffRateDeleteArgs} args - Arguments to delete one CustomsTariffRate.
     * @example
     * // Delete one CustomsTariffRate
     * const CustomsTariffRate = await prisma.customsTariffRate.delete({
     *   where: {
     *     // ... filter to delete one CustomsTariffRate
     *   }
     * })
     * 
     */
    delete<T extends CustomsTariffRateDeleteArgs>(args: SelectSubset<T, CustomsTariffRateDeleteArgs<ExtArgs>>): Prisma__CustomsTariffRateClient<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CustomsTariffRate.
     * @param {CustomsTariffRateUpdateArgs} args - Arguments to update one CustomsTariffRate.
     * @example
     * // Update one CustomsTariffRate
     * const customsTariffRate = await prisma.customsTariffRate.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CustomsTariffRateUpdateArgs>(args: SelectSubset<T, CustomsTariffRateUpdateArgs<ExtArgs>>): Prisma__CustomsTariffRateClient<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CustomsTariffRates.
     * @param {CustomsTariffRateDeleteManyArgs} args - Arguments to filter CustomsTariffRates to delete.
     * @example
     * // Delete a few CustomsTariffRates
     * const { count } = await prisma.customsTariffRate.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CustomsTariffRateDeleteManyArgs>(args?: SelectSubset<T, CustomsTariffRateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomsTariffRates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomsTariffRateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CustomsTariffRates
     * const customsTariffRate = await prisma.customsTariffRate.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CustomsTariffRateUpdateManyArgs>(args: SelectSubset<T, CustomsTariffRateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomsTariffRates and returns the data updated in the database.
     * @param {CustomsTariffRateUpdateManyAndReturnArgs} args - Arguments to update many CustomsTariffRates.
     * @example
     * // Update many CustomsTariffRates
     * const customsTariffRate = await prisma.customsTariffRate.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CustomsTariffRates and only return the `id`
     * const customsTariffRateWithIdOnly = await prisma.customsTariffRate.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CustomsTariffRateUpdateManyAndReturnArgs>(args: SelectSubset<T, CustomsTariffRateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CustomsTariffRate.
     * @param {CustomsTariffRateUpsertArgs} args - Arguments to update or create a CustomsTariffRate.
     * @example
     * // Update or create a CustomsTariffRate
     * const customsTariffRate = await prisma.customsTariffRate.upsert({
     *   create: {
     *     // ... data to create a CustomsTariffRate
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CustomsTariffRate we want to update
     *   }
     * })
     */
    upsert<T extends CustomsTariffRateUpsertArgs>(args: SelectSubset<T, CustomsTariffRateUpsertArgs<ExtArgs>>): Prisma__CustomsTariffRateClient<$Result.GetResult<Prisma.$CustomsTariffRatePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CustomsTariffRates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomsTariffRateCountArgs} args - Arguments to filter CustomsTariffRates to count.
     * @example
     * // Count the number of CustomsTariffRates
     * const count = await prisma.customsTariffRate.count({
     *   where: {
     *     // ... the filter for the CustomsTariffRates we want to count
     *   }
     * })
    **/
    count<T extends CustomsTariffRateCountArgs>(
      args?: Subset<T, CustomsTariffRateCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CustomsTariffRateCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CustomsTariffRate.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomsTariffRateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CustomsTariffRateAggregateArgs>(args: Subset<T, CustomsTariffRateAggregateArgs>): Prisma.PrismaPromise<GetCustomsTariffRateAggregateType<T>>

    /**
     * Group by CustomsTariffRate.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomsTariffRateGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CustomsTariffRateGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CustomsTariffRateGroupByArgs['orderBy'] }
        : { orderBy?: CustomsTariffRateGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CustomsTariffRateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomsTariffRateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CustomsTariffRate model
   */
  readonly fields: CustomsTariffRateFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CustomsTariffRate.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CustomsTariffRateClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CustomsTariffRate model
   */
  interface CustomsTariffRateFieldRefs {
    readonly id: FieldRef<"CustomsTariffRate", 'String'>
    readonly hsCode: FieldRef<"CustomsTariffRate", 'String'>
    readonly description: FieldRef<"CustomsTariffRate", 'String'>
    readonly dutyRatePercent: FieldRef<"CustomsTariffRate", 'Decimal'>
    readonly vatRatePercent: FieldRef<"CustomsTariffRate", 'Decimal'>
    readonly excisePercent: FieldRef<"CustomsTariffRate", 'Decimal'>
    readonly effectiveFrom: FieldRef<"CustomsTariffRate", 'DateTime'>
    readonly effectiveTo: FieldRef<"CustomsTariffRate", 'DateTime'>
    readonly notes: FieldRef<"CustomsTariffRate", 'String'>
    readonly deletedAt: FieldRef<"CustomsTariffRate", 'DateTime'>
    readonly createdAt: FieldRef<"CustomsTariffRate", 'DateTime'>
    readonly updatedAt: FieldRef<"CustomsTariffRate", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CustomsTariffRate findUnique
   */
  export type CustomsTariffRateFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * Filter, which CustomsTariffRate to fetch.
     */
    where: CustomsTariffRateWhereUniqueInput
  }

  /**
   * CustomsTariffRate findUniqueOrThrow
   */
  export type CustomsTariffRateFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * Filter, which CustomsTariffRate to fetch.
     */
    where: CustomsTariffRateWhereUniqueInput
  }

  /**
   * CustomsTariffRate findFirst
   */
  export type CustomsTariffRateFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * Filter, which CustomsTariffRate to fetch.
     */
    where?: CustomsTariffRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomsTariffRates to fetch.
     */
    orderBy?: CustomsTariffRateOrderByWithRelationInput | CustomsTariffRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomsTariffRates.
     */
    cursor?: CustomsTariffRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomsTariffRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomsTariffRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomsTariffRates.
     */
    distinct?: CustomsTariffRateScalarFieldEnum | CustomsTariffRateScalarFieldEnum[]
  }

  /**
   * CustomsTariffRate findFirstOrThrow
   */
  export type CustomsTariffRateFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * Filter, which CustomsTariffRate to fetch.
     */
    where?: CustomsTariffRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomsTariffRates to fetch.
     */
    orderBy?: CustomsTariffRateOrderByWithRelationInput | CustomsTariffRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomsTariffRates.
     */
    cursor?: CustomsTariffRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomsTariffRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomsTariffRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomsTariffRates.
     */
    distinct?: CustomsTariffRateScalarFieldEnum | CustomsTariffRateScalarFieldEnum[]
  }

  /**
   * CustomsTariffRate findMany
   */
  export type CustomsTariffRateFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * Filter, which CustomsTariffRates to fetch.
     */
    where?: CustomsTariffRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomsTariffRates to fetch.
     */
    orderBy?: CustomsTariffRateOrderByWithRelationInput | CustomsTariffRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CustomsTariffRates.
     */
    cursor?: CustomsTariffRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomsTariffRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomsTariffRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomsTariffRates.
     */
    distinct?: CustomsTariffRateScalarFieldEnum | CustomsTariffRateScalarFieldEnum[]
  }

  /**
   * CustomsTariffRate create
   */
  export type CustomsTariffRateCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * The data needed to create a CustomsTariffRate.
     */
    data: XOR<CustomsTariffRateCreateInput, CustomsTariffRateUncheckedCreateInput>
  }

  /**
   * CustomsTariffRate createMany
   */
  export type CustomsTariffRateCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CustomsTariffRates.
     */
    data: CustomsTariffRateCreateManyInput | CustomsTariffRateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CustomsTariffRate createManyAndReturn
   */
  export type CustomsTariffRateCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * The data used to create many CustomsTariffRates.
     */
    data: CustomsTariffRateCreateManyInput | CustomsTariffRateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CustomsTariffRate update
   */
  export type CustomsTariffRateUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * The data needed to update a CustomsTariffRate.
     */
    data: XOR<CustomsTariffRateUpdateInput, CustomsTariffRateUncheckedUpdateInput>
    /**
     * Choose, which CustomsTariffRate to update.
     */
    where: CustomsTariffRateWhereUniqueInput
  }

  /**
   * CustomsTariffRate updateMany
   */
  export type CustomsTariffRateUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CustomsTariffRates.
     */
    data: XOR<CustomsTariffRateUpdateManyMutationInput, CustomsTariffRateUncheckedUpdateManyInput>
    /**
     * Filter which CustomsTariffRates to update
     */
    where?: CustomsTariffRateWhereInput
    /**
     * Limit how many CustomsTariffRates to update.
     */
    limit?: number
  }

  /**
   * CustomsTariffRate updateManyAndReturn
   */
  export type CustomsTariffRateUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * The data used to update CustomsTariffRates.
     */
    data: XOR<CustomsTariffRateUpdateManyMutationInput, CustomsTariffRateUncheckedUpdateManyInput>
    /**
     * Filter which CustomsTariffRates to update
     */
    where?: CustomsTariffRateWhereInput
    /**
     * Limit how many CustomsTariffRates to update.
     */
    limit?: number
  }

  /**
   * CustomsTariffRate upsert
   */
  export type CustomsTariffRateUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * The filter to search for the CustomsTariffRate to update in case it exists.
     */
    where: CustomsTariffRateWhereUniqueInput
    /**
     * In case the CustomsTariffRate found by the `where` argument doesn't exist, create a new CustomsTariffRate with this data.
     */
    create: XOR<CustomsTariffRateCreateInput, CustomsTariffRateUncheckedCreateInput>
    /**
     * In case the CustomsTariffRate was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CustomsTariffRateUpdateInput, CustomsTariffRateUncheckedUpdateInput>
  }

  /**
   * CustomsTariffRate delete
   */
  export type CustomsTariffRateDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
    /**
     * Filter which CustomsTariffRate to delete.
     */
    where: CustomsTariffRateWhereUniqueInput
  }

  /**
   * CustomsTariffRate deleteMany
   */
  export type CustomsTariffRateDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomsTariffRates to delete
     */
    where?: CustomsTariffRateWhereInput
    /**
     * Limit how many CustomsTariffRates to delete.
     */
    limit?: number
  }

  /**
   * CustomsTariffRate without action
   */
  export type CustomsTariffRateDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomsTariffRate
     */
    select?: CustomsTariffRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomsTariffRate
     */
    omit?: CustomsTariffRateOmit<ExtArgs> | null
  }


  /**
   * Model UnitOfMeasure
   */

  export type AggregateUnitOfMeasure = {
    _count: UnitOfMeasureCountAggregateOutputType | null
    _avg: UnitOfMeasureAvgAggregateOutputType | null
    _sum: UnitOfMeasureSumAggregateOutputType | null
    _min: UnitOfMeasureMinAggregateOutputType | null
    _max: UnitOfMeasureMaxAggregateOutputType | null
  }

  export type UnitOfMeasureAvgAggregateOutputType = {
    factor: Decimal | null
    sortOrder: number | null
  }

  export type UnitOfMeasureSumAggregateOutputType = {
    factor: Decimal | null
    sortOrder: number | null
  }

  export type UnitOfMeasureMinAggregateOutputType = {
    id: string | null
    code: string | null
    kind: $Enums.UnitOfMeasureKind | null
    baseCode: string | null
    factor: Decimal | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    isActive: boolean | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UnitOfMeasureMaxAggregateOutputType = {
    id: string | null
    code: string | null
    kind: $Enums.UnitOfMeasureKind | null
    baseCode: string | null
    factor: Decimal | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    isActive: boolean | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UnitOfMeasureCountAggregateOutputType = {
    id: number
    code: number
    kind: number
    baseCode: number
    factor: number
    nameAz: number
    nameRu: number
    nameEn: number
    isActive: number
    sortOrder: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UnitOfMeasureAvgAggregateInputType = {
    factor?: true
    sortOrder?: true
  }

  export type UnitOfMeasureSumAggregateInputType = {
    factor?: true
    sortOrder?: true
  }

  export type UnitOfMeasureMinAggregateInputType = {
    id?: true
    code?: true
    kind?: true
    baseCode?: true
    factor?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    isActive?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UnitOfMeasureMaxAggregateInputType = {
    id?: true
    code?: true
    kind?: true
    baseCode?: true
    factor?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    isActive?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UnitOfMeasureCountAggregateInputType = {
    id?: true
    code?: true
    kind?: true
    baseCode?: true
    factor?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    isActive?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UnitOfMeasureAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UnitOfMeasure to aggregate.
     */
    where?: UnitOfMeasureWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UnitOfMeasures to fetch.
     */
    orderBy?: UnitOfMeasureOrderByWithRelationInput | UnitOfMeasureOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UnitOfMeasureWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UnitOfMeasures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UnitOfMeasures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UnitOfMeasures
    **/
    _count?: true | UnitOfMeasureCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UnitOfMeasureAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UnitOfMeasureSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UnitOfMeasureMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UnitOfMeasureMaxAggregateInputType
  }

  export type GetUnitOfMeasureAggregateType<T extends UnitOfMeasureAggregateArgs> = {
        [P in keyof T & keyof AggregateUnitOfMeasure]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUnitOfMeasure[P]>
      : GetScalarType<T[P], AggregateUnitOfMeasure[P]>
  }




  export type UnitOfMeasureGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UnitOfMeasureWhereInput
    orderBy?: UnitOfMeasureOrderByWithAggregationInput | UnitOfMeasureOrderByWithAggregationInput[]
    by: UnitOfMeasureScalarFieldEnum[] | UnitOfMeasureScalarFieldEnum
    having?: UnitOfMeasureScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UnitOfMeasureCountAggregateInputType | true
    _avg?: UnitOfMeasureAvgAggregateInputType
    _sum?: UnitOfMeasureSumAggregateInputType
    _min?: UnitOfMeasureMinAggregateInputType
    _max?: UnitOfMeasureMaxAggregateInputType
  }

  export type UnitOfMeasureGroupByOutputType = {
    id: string
    code: string
    kind: $Enums.UnitOfMeasureKind
    baseCode: string | null
    factor: Decimal
    nameAz: string
    nameRu: string
    nameEn: string
    isActive: boolean
    sortOrder: number
    createdAt: Date
    updatedAt: Date
    _count: UnitOfMeasureCountAggregateOutputType | null
    _avg: UnitOfMeasureAvgAggregateOutputType | null
    _sum: UnitOfMeasureSumAggregateOutputType | null
    _min: UnitOfMeasureMinAggregateOutputType | null
    _max: UnitOfMeasureMaxAggregateOutputType | null
  }

  type GetUnitOfMeasureGroupByPayload<T extends UnitOfMeasureGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UnitOfMeasureGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UnitOfMeasureGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UnitOfMeasureGroupByOutputType[P]>
            : GetScalarType<T[P], UnitOfMeasureGroupByOutputType[P]>
        }
      >
    >


  export type UnitOfMeasureSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    kind?: boolean
    baseCode?: boolean
    factor?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    isActive?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["unitOfMeasure"]>

  export type UnitOfMeasureSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    kind?: boolean
    baseCode?: boolean
    factor?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    isActive?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["unitOfMeasure"]>

  export type UnitOfMeasureSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    kind?: boolean
    baseCode?: boolean
    factor?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    isActive?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["unitOfMeasure"]>

  export type UnitOfMeasureSelectScalar = {
    id?: boolean
    code?: boolean
    kind?: boolean
    baseCode?: boolean
    factor?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    isActive?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UnitOfMeasureOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "code" | "kind" | "baseCode" | "factor" | "nameAz" | "nameRu" | "nameEn" | "isActive" | "sortOrder" | "createdAt" | "updatedAt", ExtArgs["result"]["unitOfMeasure"]>

  export type $UnitOfMeasurePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UnitOfMeasure"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      code: string
      kind: $Enums.UnitOfMeasureKind
      baseCode: string | null
      factor: Prisma.Decimal
      nameAz: string
      nameRu: string
      nameEn: string
      isActive: boolean
      sortOrder: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["unitOfMeasure"]>
    composites: {}
  }

  type UnitOfMeasureGetPayload<S extends boolean | null | undefined | UnitOfMeasureDefaultArgs> = $Result.GetResult<Prisma.$UnitOfMeasurePayload, S>

  type UnitOfMeasureCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UnitOfMeasureFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UnitOfMeasureCountAggregateInputType | true
    }

  export interface UnitOfMeasureDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UnitOfMeasure'], meta: { name: 'UnitOfMeasure' } }
    /**
     * Find zero or one UnitOfMeasure that matches the filter.
     * @param {UnitOfMeasureFindUniqueArgs} args - Arguments to find a UnitOfMeasure
     * @example
     * // Get one UnitOfMeasure
     * const unitOfMeasure = await prisma.unitOfMeasure.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UnitOfMeasureFindUniqueArgs>(args: SelectSubset<T, UnitOfMeasureFindUniqueArgs<ExtArgs>>): Prisma__UnitOfMeasureClient<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one UnitOfMeasure that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UnitOfMeasureFindUniqueOrThrowArgs} args - Arguments to find a UnitOfMeasure
     * @example
     * // Get one UnitOfMeasure
     * const unitOfMeasure = await prisma.unitOfMeasure.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UnitOfMeasureFindUniqueOrThrowArgs>(args: SelectSubset<T, UnitOfMeasureFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UnitOfMeasureClient<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UnitOfMeasure that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnitOfMeasureFindFirstArgs} args - Arguments to find a UnitOfMeasure
     * @example
     * // Get one UnitOfMeasure
     * const unitOfMeasure = await prisma.unitOfMeasure.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UnitOfMeasureFindFirstArgs>(args?: SelectSubset<T, UnitOfMeasureFindFirstArgs<ExtArgs>>): Prisma__UnitOfMeasureClient<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UnitOfMeasure that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnitOfMeasureFindFirstOrThrowArgs} args - Arguments to find a UnitOfMeasure
     * @example
     * // Get one UnitOfMeasure
     * const unitOfMeasure = await prisma.unitOfMeasure.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UnitOfMeasureFindFirstOrThrowArgs>(args?: SelectSubset<T, UnitOfMeasureFindFirstOrThrowArgs<ExtArgs>>): Prisma__UnitOfMeasureClient<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more UnitOfMeasures that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnitOfMeasureFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UnitOfMeasures
     * const unitOfMeasures = await prisma.unitOfMeasure.findMany()
     * 
     * // Get first 10 UnitOfMeasures
     * const unitOfMeasures = await prisma.unitOfMeasure.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const unitOfMeasureWithIdOnly = await prisma.unitOfMeasure.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UnitOfMeasureFindManyArgs>(args?: SelectSubset<T, UnitOfMeasureFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a UnitOfMeasure.
     * @param {UnitOfMeasureCreateArgs} args - Arguments to create a UnitOfMeasure.
     * @example
     * // Create one UnitOfMeasure
     * const UnitOfMeasure = await prisma.unitOfMeasure.create({
     *   data: {
     *     // ... data to create a UnitOfMeasure
     *   }
     * })
     * 
     */
    create<T extends UnitOfMeasureCreateArgs>(args: SelectSubset<T, UnitOfMeasureCreateArgs<ExtArgs>>): Prisma__UnitOfMeasureClient<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many UnitOfMeasures.
     * @param {UnitOfMeasureCreateManyArgs} args - Arguments to create many UnitOfMeasures.
     * @example
     * // Create many UnitOfMeasures
     * const unitOfMeasure = await prisma.unitOfMeasure.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UnitOfMeasureCreateManyArgs>(args?: SelectSubset<T, UnitOfMeasureCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UnitOfMeasures and returns the data saved in the database.
     * @param {UnitOfMeasureCreateManyAndReturnArgs} args - Arguments to create many UnitOfMeasures.
     * @example
     * // Create many UnitOfMeasures
     * const unitOfMeasure = await prisma.unitOfMeasure.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UnitOfMeasures and only return the `id`
     * const unitOfMeasureWithIdOnly = await prisma.unitOfMeasure.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UnitOfMeasureCreateManyAndReturnArgs>(args?: SelectSubset<T, UnitOfMeasureCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a UnitOfMeasure.
     * @param {UnitOfMeasureDeleteArgs} args - Arguments to delete one UnitOfMeasure.
     * @example
     * // Delete one UnitOfMeasure
     * const UnitOfMeasure = await prisma.unitOfMeasure.delete({
     *   where: {
     *     // ... filter to delete one UnitOfMeasure
     *   }
     * })
     * 
     */
    delete<T extends UnitOfMeasureDeleteArgs>(args: SelectSubset<T, UnitOfMeasureDeleteArgs<ExtArgs>>): Prisma__UnitOfMeasureClient<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one UnitOfMeasure.
     * @param {UnitOfMeasureUpdateArgs} args - Arguments to update one UnitOfMeasure.
     * @example
     * // Update one UnitOfMeasure
     * const unitOfMeasure = await prisma.unitOfMeasure.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UnitOfMeasureUpdateArgs>(args: SelectSubset<T, UnitOfMeasureUpdateArgs<ExtArgs>>): Prisma__UnitOfMeasureClient<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more UnitOfMeasures.
     * @param {UnitOfMeasureDeleteManyArgs} args - Arguments to filter UnitOfMeasures to delete.
     * @example
     * // Delete a few UnitOfMeasures
     * const { count } = await prisma.unitOfMeasure.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UnitOfMeasureDeleteManyArgs>(args?: SelectSubset<T, UnitOfMeasureDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UnitOfMeasures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnitOfMeasureUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UnitOfMeasures
     * const unitOfMeasure = await prisma.unitOfMeasure.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UnitOfMeasureUpdateManyArgs>(args: SelectSubset<T, UnitOfMeasureUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UnitOfMeasures and returns the data updated in the database.
     * @param {UnitOfMeasureUpdateManyAndReturnArgs} args - Arguments to update many UnitOfMeasures.
     * @example
     * // Update many UnitOfMeasures
     * const unitOfMeasure = await prisma.unitOfMeasure.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more UnitOfMeasures and only return the `id`
     * const unitOfMeasureWithIdOnly = await prisma.unitOfMeasure.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UnitOfMeasureUpdateManyAndReturnArgs>(args: SelectSubset<T, UnitOfMeasureUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one UnitOfMeasure.
     * @param {UnitOfMeasureUpsertArgs} args - Arguments to update or create a UnitOfMeasure.
     * @example
     * // Update or create a UnitOfMeasure
     * const unitOfMeasure = await prisma.unitOfMeasure.upsert({
     *   create: {
     *     // ... data to create a UnitOfMeasure
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UnitOfMeasure we want to update
     *   }
     * })
     */
    upsert<T extends UnitOfMeasureUpsertArgs>(args: SelectSubset<T, UnitOfMeasureUpsertArgs<ExtArgs>>): Prisma__UnitOfMeasureClient<$Result.GetResult<Prisma.$UnitOfMeasurePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of UnitOfMeasures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnitOfMeasureCountArgs} args - Arguments to filter UnitOfMeasures to count.
     * @example
     * // Count the number of UnitOfMeasures
     * const count = await prisma.unitOfMeasure.count({
     *   where: {
     *     // ... the filter for the UnitOfMeasures we want to count
     *   }
     * })
    **/
    count<T extends UnitOfMeasureCountArgs>(
      args?: Subset<T, UnitOfMeasureCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UnitOfMeasureCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UnitOfMeasure.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnitOfMeasureAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UnitOfMeasureAggregateArgs>(args: Subset<T, UnitOfMeasureAggregateArgs>): Prisma.PrismaPromise<GetUnitOfMeasureAggregateType<T>>

    /**
     * Group by UnitOfMeasure.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnitOfMeasureGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UnitOfMeasureGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UnitOfMeasureGroupByArgs['orderBy'] }
        : { orderBy?: UnitOfMeasureGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UnitOfMeasureGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUnitOfMeasureGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UnitOfMeasure model
   */
  readonly fields: UnitOfMeasureFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UnitOfMeasure.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UnitOfMeasureClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UnitOfMeasure model
   */
  interface UnitOfMeasureFieldRefs {
    readonly id: FieldRef<"UnitOfMeasure", 'String'>
    readonly code: FieldRef<"UnitOfMeasure", 'String'>
    readonly kind: FieldRef<"UnitOfMeasure", 'UnitOfMeasureKind'>
    readonly baseCode: FieldRef<"UnitOfMeasure", 'String'>
    readonly factor: FieldRef<"UnitOfMeasure", 'Decimal'>
    readonly nameAz: FieldRef<"UnitOfMeasure", 'String'>
    readonly nameRu: FieldRef<"UnitOfMeasure", 'String'>
    readonly nameEn: FieldRef<"UnitOfMeasure", 'String'>
    readonly isActive: FieldRef<"UnitOfMeasure", 'Boolean'>
    readonly sortOrder: FieldRef<"UnitOfMeasure", 'Int'>
    readonly createdAt: FieldRef<"UnitOfMeasure", 'DateTime'>
    readonly updatedAt: FieldRef<"UnitOfMeasure", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UnitOfMeasure findUnique
   */
  export type UnitOfMeasureFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * Filter, which UnitOfMeasure to fetch.
     */
    where: UnitOfMeasureWhereUniqueInput
  }

  /**
   * UnitOfMeasure findUniqueOrThrow
   */
  export type UnitOfMeasureFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * Filter, which UnitOfMeasure to fetch.
     */
    where: UnitOfMeasureWhereUniqueInput
  }

  /**
   * UnitOfMeasure findFirst
   */
  export type UnitOfMeasureFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * Filter, which UnitOfMeasure to fetch.
     */
    where?: UnitOfMeasureWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UnitOfMeasures to fetch.
     */
    orderBy?: UnitOfMeasureOrderByWithRelationInput | UnitOfMeasureOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UnitOfMeasures.
     */
    cursor?: UnitOfMeasureWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UnitOfMeasures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UnitOfMeasures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UnitOfMeasures.
     */
    distinct?: UnitOfMeasureScalarFieldEnum | UnitOfMeasureScalarFieldEnum[]
  }

  /**
   * UnitOfMeasure findFirstOrThrow
   */
  export type UnitOfMeasureFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * Filter, which UnitOfMeasure to fetch.
     */
    where?: UnitOfMeasureWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UnitOfMeasures to fetch.
     */
    orderBy?: UnitOfMeasureOrderByWithRelationInput | UnitOfMeasureOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UnitOfMeasures.
     */
    cursor?: UnitOfMeasureWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UnitOfMeasures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UnitOfMeasures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UnitOfMeasures.
     */
    distinct?: UnitOfMeasureScalarFieldEnum | UnitOfMeasureScalarFieldEnum[]
  }

  /**
   * UnitOfMeasure findMany
   */
  export type UnitOfMeasureFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * Filter, which UnitOfMeasures to fetch.
     */
    where?: UnitOfMeasureWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UnitOfMeasures to fetch.
     */
    orderBy?: UnitOfMeasureOrderByWithRelationInput | UnitOfMeasureOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UnitOfMeasures.
     */
    cursor?: UnitOfMeasureWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UnitOfMeasures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UnitOfMeasures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UnitOfMeasures.
     */
    distinct?: UnitOfMeasureScalarFieldEnum | UnitOfMeasureScalarFieldEnum[]
  }

  /**
   * UnitOfMeasure create
   */
  export type UnitOfMeasureCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * The data needed to create a UnitOfMeasure.
     */
    data: XOR<UnitOfMeasureCreateInput, UnitOfMeasureUncheckedCreateInput>
  }

  /**
   * UnitOfMeasure createMany
   */
  export type UnitOfMeasureCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UnitOfMeasures.
     */
    data: UnitOfMeasureCreateManyInput | UnitOfMeasureCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UnitOfMeasure createManyAndReturn
   */
  export type UnitOfMeasureCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * The data used to create many UnitOfMeasures.
     */
    data: UnitOfMeasureCreateManyInput | UnitOfMeasureCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UnitOfMeasure update
   */
  export type UnitOfMeasureUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * The data needed to update a UnitOfMeasure.
     */
    data: XOR<UnitOfMeasureUpdateInput, UnitOfMeasureUncheckedUpdateInput>
    /**
     * Choose, which UnitOfMeasure to update.
     */
    where: UnitOfMeasureWhereUniqueInput
  }

  /**
   * UnitOfMeasure updateMany
   */
  export type UnitOfMeasureUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UnitOfMeasures.
     */
    data: XOR<UnitOfMeasureUpdateManyMutationInput, UnitOfMeasureUncheckedUpdateManyInput>
    /**
     * Filter which UnitOfMeasures to update
     */
    where?: UnitOfMeasureWhereInput
    /**
     * Limit how many UnitOfMeasures to update.
     */
    limit?: number
  }

  /**
   * UnitOfMeasure updateManyAndReturn
   */
  export type UnitOfMeasureUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * The data used to update UnitOfMeasures.
     */
    data: XOR<UnitOfMeasureUpdateManyMutationInput, UnitOfMeasureUncheckedUpdateManyInput>
    /**
     * Filter which UnitOfMeasures to update
     */
    where?: UnitOfMeasureWhereInput
    /**
     * Limit how many UnitOfMeasures to update.
     */
    limit?: number
  }

  /**
   * UnitOfMeasure upsert
   */
  export type UnitOfMeasureUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * The filter to search for the UnitOfMeasure to update in case it exists.
     */
    where: UnitOfMeasureWhereUniqueInput
    /**
     * In case the UnitOfMeasure found by the `where` argument doesn't exist, create a new UnitOfMeasure with this data.
     */
    create: XOR<UnitOfMeasureCreateInput, UnitOfMeasureUncheckedCreateInput>
    /**
     * In case the UnitOfMeasure was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UnitOfMeasureUpdateInput, UnitOfMeasureUncheckedUpdateInput>
  }

  /**
   * UnitOfMeasure delete
   */
  export type UnitOfMeasureDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
    /**
     * Filter which UnitOfMeasure to delete.
     */
    where: UnitOfMeasureWhereUniqueInput
  }

  /**
   * UnitOfMeasure deleteMany
   */
  export type UnitOfMeasureDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UnitOfMeasures to delete
     */
    where?: UnitOfMeasureWhereInput
    /**
     * Limit how many UnitOfMeasures to delete.
     */
    limit?: number
  }

  /**
   * UnitOfMeasure without action
   */
  export type UnitOfMeasureDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnitOfMeasure
     */
    select?: UnitOfMeasureSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnitOfMeasure
     */
    omit?: UnitOfMeasureOmit<ExtArgs> | null
  }


  /**
   * Model Currency
   */

  export type AggregateCurrency = {
    _count: CurrencyCountAggregateOutputType | null
    _avg: CurrencyAvgAggregateOutputType | null
    _sum: CurrencySumAggregateOutputType | null
    _min: CurrencyMinAggregateOutputType | null
    _max: CurrencyMaxAggregateOutputType | null
  }

  export type CurrencyAvgAggregateOutputType = {
    decimals: number | null
    sortOrder: number | null
  }

  export type CurrencySumAggregateOutputType = {
    decimals: number | null
    sortOrder: number | null
  }

  export type CurrencyMinAggregateOutputType = {
    id: string | null
    code: string | null
    symbol: string | null
    decimals: number | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    isActive: boolean | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CurrencyMaxAggregateOutputType = {
    id: string | null
    code: string | null
    symbol: string | null
    decimals: number | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    isActive: boolean | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CurrencyCountAggregateOutputType = {
    id: number
    code: number
    symbol: number
    decimals: number
    nameAz: number
    nameRu: number
    nameEn: number
    isActive: number
    sortOrder: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CurrencyAvgAggregateInputType = {
    decimals?: true
    sortOrder?: true
  }

  export type CurrencySumAggregateInputType = {
    decimals?: true
    sortOrder?: true
  }

  export type CurrencyMinAggregateInputType = {
    id?: true
    code?: true
    symbol?: true
    decimals?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    isActive?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CurrencyMaxAggregateInputType = {
    id?: true
    code?: true
    symbol?: true
    decimals?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    isActive?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CurrencyCountAggregateInputType = {
    id?: true
    code?: true
    symbol?: true
    decimals?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    isActive?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CurrencyAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Currency to aggregate.
     */
    where?: CurrencyWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Currencies to fetch.
     */
    orderBy?: CurrencyOrderByWithRelationInput | CurrencyOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CurrencyWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Currencies from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Currencies.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Currencies
    **/
    _count?: true | CurrencyCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CurrencyAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CurrencySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CurrencyMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CurrencyMaxAggregateInputType
  }

  export type GetCurrencyAggregateType<T extends CurrencyAggregateArgs> = {
        [P in keyof T & keyof AggregateCurrency]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCurrency[P]>
      : GetScalarType<T[P], AggregateCurrency[P]>
  }




  export type CurrencyGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CurrencyWhereInput
    orderBy?: CurrencyOrderByWithAggregationInput | CurrencyOrderByWithAggregationInput[]
    by: CurrencyScalarFieldEnum[] | CurrencyScalarFieldEnum
    having?: CurrencyScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CurrencyCountAggregateInputType | true
    _avg?: CurrencyAvgAggregateInputType
    _sum?: CurrencySumAggregateInputType
    _min?: CurrencyMinAggregateInputType
    _max?: CurrencyMaxAggregateInputType
  }

  export type CurrencyGroupByOutputType = {
    id: string
    code: string
    symbol: string
    decimals: number
    nameAz: string
    nameRu: string
    nameEn: string
    isActive: boolean
    sortOrder: number
    createdAt: Date
    updatedAt: Date
    _count: CurrencyCountAggregateOutputType | null
    _avg: CurrencyAvgAggregateOutputType | null
    _sum: CurrencySumAggregateOutputType | null
    _min: CurrencyMinAggregateOutputType | null
    _max: CurrencyMaxAggregateOutputType | null
  }

  type GetCurrencyGroupByPayload<T extends CurrencyGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CurrencyGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CurrencyGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CurrencyGroupByOutputType[P]>
            : GetScalarType<T[P], CurrencyGroupByOutputType[P]>
        }
      >
    >


  export type CurrencySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    symbol?: boolean
    decimals?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    isActive?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["currency"]>

  export type CurrencySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    symbol?: boolean
    decimals?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    isActive?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["currency"]>

  export type CurrencySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    symbol?: boolean
    decimals?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    isActive?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["currency"]>

  export type CurrencySelectScalar = {
    id?: boolean
    code?: boolean
    symbol?: boolean
    decimals?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    isActive?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CurrencyOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "code" | "symbol" | "decimals" | "nameAz" | "nameRu" | "nameEn" | "isActive" | "sortOrder" | "createdAt" | "updatedAt", ExtArgs["result"]["currency"]>

  export type $CurrencyPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Currency"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      code: string
      symbol: string
      decimals: number
      nameAz: string
      nameRu: string
      nameEn: string
      isActive: boolean
      sortOrder: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["currency"]>
    composites: {}
  }

  type CurrencyGetPayload<S extends boolean | null | undefined | CurrencyDefaultArgs> = $Result.GetResult<Prisma.$CurrencyPayload, S>

  type CurrencyCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CurrencyFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CurrencyCountAggregateInputType | true
    }

  export interface CurrencyDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Currency'], meta: { name: 'Currency' } }
    /**
     * Find zero or one Currency that matches the filter.
     * @param {CurrencyFindUniqueArgs} args - Arguments to find a Currency
     * @example
     * // Get one Currency
     * const currency = await prisma.currency.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CurrencyFindUniqueArgs>(args: SelectSubset<T, CurrencyFindUniqueArgs<ExtArgs>>): Prisma__CurrencyClient<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Currency that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CurrencyFindUniqueOrThrowArgs} args - Arguments to find a Currency
     * @example
     * // Get one Currency
     * const currency = await prisma.currency.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CurrencyFindUniqueOrThrowArgs>(args: SelectSubset<T, CurrencyFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CurrencyClient<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Currency that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CurrencyFindFirstArgs} args - Arguments to find a Currency
     * @example
     * // Get one Currency
     * const currency = await prisma.currency.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CurrencyFindFirstArgs>(args?: SelectSubset<T, CurrencyFindFirstArgs<ExtArgs>>): Prisma__CurrencyClient<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Currency that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CurrencyFindFirstOrThrowArgs} args - Arguments to find a Currency
     * @example
     * // Get one Currency
     * const currency = await prisma.currency.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CurrencyFindFirstOrThrowArgs>(args?: SelectSubset<T, CurrencyFindFirstOrThrowArgs<ExtArgs>>): Prisma__CurrencyClient<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Currencies that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CurrencyFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Currencies
     * const currencies = await prisma.currency.findMany()
     * 
     * // Get first 10 Currencies
     * const currencies = await prisma.currency.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const currencyWithIdOnly = await prisma.currency.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CurrencyFindManyArgs>(args?: SelectSubset<T, CurrencyFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Currency.
     * @param {CurrencyCreateArgs} args - Arguments to create a Currency.
     * @example
     * // Create one Currency
     * const Currency = await prisma.currency.create({
     *   data: {
     *     // ... data to create a Currency
     *   }
     * })
     * 
     */
    create<T extends CurrencyCreateArgs>(args: SelectSubset<T, CurrencyCreateArgs<ExtArgs>>): Prisma__CurrencyClient<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Currencies.
     * @param {CurrencyCreateManyArgs} args - Arguments to create many Currencies.
     * @example
     * // Create many Currencies
     * const currency = await prisma.currency.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CurrencyCreateManyArgs>(args?: SelectSubset<T, CurrencyCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Currencies and returns the data saved in the database.
     * @param {CurrencyCreateManyAndReturnArgs} args - Arguments to create many Currencies.
     * @example
     * // Create many Currencies
     * const currency = await prisma.currency.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Currencies and only return the `id`
     * const currencyWithIdOnly = await prisma.currency.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CurrencyCreateManyAndReturnArgs>(args?: SelectSubset<T, CurrencyCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Currency.
     * @param {CurrencyDeleteArgs} args - Arguments to delete one Currency.
     * @example
     * // Delete one Currency
     * const Currency = await prisma.currency.delete({
     *   where: {
     *     // ... filter to delete one Currency
     *   }
     * })
     * 
     */
    delete<T extends CurrencyDeleteArgs>(args: SelectSubset<T, CurrencyDeleteArgs<ExtArgs>>): Prisma__CurrencyClient<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Currency.
     * @param {CurrencyUpdateArgs} args - Arguments to update one Currency.
     * @example
     * // Update one Currency
     * const currency = await prisma.currency.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CurrencyUpdateArgs>(args: SelectSubset<T, CurrencyUpdateArgs<ExtArgs>>): Prisma__CurrencyClient<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Currencies.
     * @param {CurrencyDeleteManyArgs} args - Arguments to filter Currencies to delete.
     * @example
     * // Delete a few Currencies
     * const { count } = await prisma.currency.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CurrencyDeleteManyArgs>(args?: SelectSubset<T, CurrencyDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Currencies.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CurrencyUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Currencies
     * const currency = await prisma.currency.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CurrencyUpdateManyArgs>(args: SelectSubset<T, CurrencyUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Currencies and returns the data updated in the database.
     * @param {CurrencyUpdateManyAndReturnArgs} args - Arguments to update many Currencies.
     * @example
     * // Update many Currencies
     * const currency = await prisma.currency.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Currencies and only return the `id`
     * const currencyWithIdOnly = await prisma.currency.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CurrencyUpdateManyAndReturnArgs>(args: SelectSubset<T, CurrencyUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Currency.
     * @param {CurrencyUpsertArgs} args - Arguments to update or create a Currency.
     * @example
     * // Update or create a Currency
     * const currency = await prisma.currency.upsert({
     *   create: {
     *     // ... data to create a Currency
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Currency we want to update
     *   }
     * })
     */
    upsert<T extends CurrencyUpsertArgs>(args: SelectSubset<T, CurrencyUpsertArgs<ExtArgs>>): Prisma__CurrencyClient<$Result.GetResult<Prisma.$CurrencyPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Currencies.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CurrencyCountArgs} args - Arguments to filter Currencies to count.
     * @example
     * // Count the number of Currencies
     * const count = await prisma.currency.count({
     *   where: {
     *     // ... the filter for the Currencies we want to count
     *   }
     * })
    **/
    count<T extends CurrencyCountArgs>(
      args?: Subset<T, CurrencyCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CurrencyCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Currency.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CurrencyAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CurrencyAggregateArgs>(args: Subset<T, CurrencyAggregateArgs>): Prisma.PrismaPromise<GetCurrencyAggregateType<T>>

    /**
     * Group by Currency.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CurrencyGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CurrencyGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CurrencyGroupByArgs['orderBy'] }
        : { orderBy?: CurrencyGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CurrencyGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCurrencyGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Currency model
   */
  readonly fields: CurrencyFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Currency.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CurrencyClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Currency model
   */
  interface CurrencyFieldRefs {
    readonly id: FieldRef<"Currency", 'String'>
    readonly code: FieldRef<"Currency", 'String'>
    readonly symbol: FieldRef<"Currency", 'String'>
    readonly decimals: FieldRef<"Currency", 'Int'>
    readonly nameAz: FieldRef<"Currency", 'String'>
    readonly nameRu: FieldRef<"Currency", 'String'>
    readonly nameEn: FieldRef<"Currency", 'String'>
    readonly isActive: FieldRef<"Currency", 'Boolean'>
    readonly sortOrder: FieldRef<"Currency", 'Int'>
    readonly createdAt: FieldRef<"Currency", 'DateTime'>
    readonly updatedAt: FieldRef<"Currency", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Currency findUnique
   */
  export type CurrencyFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * Filter, which Currency to fetch.
     */
    where: CurrencyWhereUniqueInput
  }

  /**
   * Currency findUniqueOrThrow
   */
  export type CurrencyFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * Filter, which Currency to fetch.
     */
    where: CurrencyWhereUniqueInput
  }

  /**
   * Currency findFirst
   */
  export type CurrencyFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * Filter, which Currency to fetch.
     */
    where?: CurrencyWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Currencies to fetch.
     */
    orderBy?: CurrencyOrderByWithRelationInput | CurrencyOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Currencies.
     */
    cursor?: CurrencyWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Currencies from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Currencies.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Currencies.
     */
    distinct?: CurrencyScalarFieldEnum | CurrencyScalarFieldEnum[]
  }

  /**
   * Currency findFirstOrThrow
   */
  export type CurrencyFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * Filter, which Currency to fetch.
     */
    where?: CurrencyWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Currencies to fetch.
     */
    orderBy?: CurrencyOrderByWithRelationInput | CurrencyOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Currencies.
     */
    cursor?: CurrencyWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Currencies from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Currencies.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Currencies.
     */
    distinct?: CurrencyScalarFieldEnum | CurrencyScalarFieldEnum[]
  }

  /**
   * Currency findMany
   */
  export type CurrencyFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * Filter, which Currencies to fetch.
     */
    where?: CurrencyWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Currencies to fetch.
     */
    orderBy?: CurrencyOrderByWithRelationInput | CurrencyOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Currencies.
     */
    cursor?: CurrencyWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Currencies from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Currencies.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Currencies.
     */
    distinct?: CurrencyScalarFieldEnum | CurrencyScalarFieldEnum[]
  }

  /**
   * Currency create
   */
  export type CurrencyCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * The data needed to create a Currency.
     */
    data: XOR<CurrencyCreateInput, CurrencyUncheckedCreateInput>
  }

  /**
   * Currency createMany
   */
  export type CurrencyCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Currencies.
     */
    data: CurrencyCreateManyInput | CurrencyCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Currency createManyAndReturn
   */
  export type CurrencyCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * The data used to create many Currencies.
     */
    data: CurrencyCreateManyInput | CurrencyCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Currency update
   */
  export type CurrencyUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * The data needed to update a Currency.
     */
    data: XOR<CurrencyUpdateInput, CurrencyUncheckedUpdateInput>
    /**
     * Choose, which Currency to update.
     */
    where: CurrencyWhereUniqueInput
  }

  /**
   * Currency updateMany
   */
  export type CurrencyUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Currencies.
     */
    data: XOR<CurrencyUpdateManyMutationInput, CurrencyUncheckedUpdateManyInput>
    /**
     * Filter which Currencies to update
     */
    where?: CurrencyWhereInput
    /**
     * Limit how many Currencies to update.
     */
    limit?: number
  }

  /**
   * Currency updateManyAndReturn
   */
  export type CurrencyUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * The data used to update Currencies.
     */
    data: XOR<CurrencyUpdateManyMutationInput, CurrencyUncheckedUpdateManyInput>
    /**
     * Filter which Currencies to update
     */
    where?: CurrencyWhereInput
    /**
     * Limit how many Currencies to update.
     */
    limit?: number
  }

  /**
   * Currency upsert
   */
  export type CurrencyUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * The filter to search for the Currency to update in case it exists.
     */
    where: CurrencyWhereUniqueInput
    /**
     * In case the Currency found by the `where` argument doesn't exist, create a new Currency with this data.
     */
    create: XOR<CurrencyCreateInput, CurrencyUncheckedCreateInput>
    /**
     * In case the Currency was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CurrencyUpdateInput, CurrencyUncheckedUpdateInput>
  }

  /**
   * Currency delete
   */
  export type CurrencyDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
    /**
     * Filter which Currency to delete.
     */
    where: CurrencyWhereUniqueInput
  }

  /**
   * Currency deleteMany
   */
  export type CurrencyDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Currencies to delete
     */
    where?: CurrencyWhereInput
    /**
     * Limit how many Currencies to delete.
     */
    limit?: number
  }

  /**
   * Currency without action
   */
  export type CurrencyDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Currency
     */
    select?: CurrencySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Currency
     */
    omit?: CurrencyOmit<ExtArgs> | null
  }


  /**
   * Model Country
   */

  export type AggregateCountry = {
    _count: CountryCountAggregateOutputType | null
    _avg: CountryAvgAggregateOutputType | null
    _sum: CountrySumAggregateOutputType | null
    _min: CountryMinAggregateOutputType | null
    _max: CountryMaxAggregateOutputType | null
  }

  export type CountryAvgAggregateOutputType = {
    sortOrder: number | null
  }

  export type CountrySumAggregateOutputType = {
    sortOrder: number | null
  }

  export type CountryMinAggregateOutputType = {
    id: string | null
    iso2: string | null
    iso3: string | null
    dialingCode: string | null
    currencyCode: string | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CountryMaxAggregateOutputType = {
    id: string | null
    iso2: string | null
    iso3: string | null
    dialingCode: string | null
    currencyCode: string | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CountryCountAggregateOutputType = {
    id: number
    iso2: number
    iso3: number
    dialingCode: number
    currencyCode: number
    nameAz: number
    nameRu: number
    nameEn: number
    sortOrder: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CountryAvgAggregateInputType = {
    sortOrder?: true
  }

  export type CountrySumAggregateInputType = {
    sortOrder?: true
  }

  export type CountryMinAggregateInputType = {
    id?: true
    iso2?: true
    iso3?: true
    dialingCode?: true
    currencyCode?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CountryMaxAggregateInputType = {
    id?: true
    iso2?: true
    iso3?: true
    dialingCode?: true
    currencyCode?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CountryCountAggregateInputType = {
    id?: true
    iso2?: true
    iso3?: true
    dialingCode?: true
    currencyCode?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CountryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Country to aggregate.
     */
    where?: CountryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Countries to fetch.
     */
    orderBy?: CountryOrderByWithRelationInput | CountryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CountryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Countries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Countries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Countries
    **/
    _count?: true | CountryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CountryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CountrySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CountryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CountryMaxAggregateInputType
  }

  export type GetCountryAggregateType<T extends CountryAggregateArgs> = {
        [P in keyof T & keyof AggregateCountry]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCountry[P]>
      : GetScalarType<T[P], AggregateCountry[P]>
  }




  export type CountryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CountryWhereInput
    orderBy?: CountryOrderByWithAggregationInput | CountryOrderByWithAggregationInput[]
    by: CountryScalarFieldEnum[] | CountryScalarFieldEnum
    having?: CountryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CountryCountAggregateInputType | true
    _avg?: CountryAvgAggregateInputType
    _sum?: CountrySumAggregateInputType
    _min?: CountryMinAggregateInputType
    _max?: CountryMaxAggregateInputType
  }

  export type CountryGroupByOutputType = {
    id: string
    iso2: string
    iso3: string | null
    dialingCode: string | null
    currencyCode: string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder: number
    createdAt: Date
    updatedAt: Date
    _count: CountryCountAggregateOutputType | null
    _avg: CountryAvgAggregateOutputType | null
    _sum: CountrySumAggregateOutputType | null
    _min: CountryMinAggregateOutputType | null
    _max: CountryMaxAggregateOutputType | null
  }

  type GetCountryGroupByPayload<T extends CountryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CountryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CountryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CountryGroupByOutputType[P]>
            : GetScalarType<T[P], CountryGroupByOutputType[P]>
        }
      >
    >


  export type CountrySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    iso2?: boolean
    iso3?: boolean
    dialingCode?: boolean
    currencyCode?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    cities?: boolean | Country$citiesArgs<ExtArgs>
    _count?: boolean | CountryCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["country"]>

  export type CountrySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    iso2?: boolean
    iso3?: boolean
    dialingCode?: boolean
    currencyCode?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["country"]>

  export type CountrySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    iso2?: boolean
    iso3?: boolean
    dialingCode?: boolean
    currencyCode?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["country"]>

  export type CountrySelectScalar = {
    id?: boolean
    iso2?: boolean
    iso3?: boolean
    dialingCode?: boolean
    currencyCode?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CountryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "iso2" | "iso3" | "dialingCode" | "currencyCode" | "nameAz" | "nameRu" | "nameEn" | "sortOrder" | "createdAt" | "updatedAt", ExtArgs["result"]["country"]>
  export type CountryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    cities?: boolean | Country$citiesArgs<ExtArgs>
    _count?: boolean | CountryCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CountryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type CountryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $CountryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Country"
    objects: {
      cities: Prisma.$CityPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      iso2: string
      iso3: string | null
      dialingCode: string | null
      currencyCode: string | null
      nameAz: string
      nameRu: string
      nameEn: string
      sortOrder: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["country"]>
    composites: {}
  }

  type CountryGetPayload<S extends boolean | null | undefined | CountryDefaultArgs> = $Result.GetResult<Prisma.$CountryPayload, S>

  type CountryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CountryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CountryCountAggregateInputType | true
    }

  export interface CountryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Country'], meta: { name: 'Country' } }
    /**
     * Find zero or one Country that matches the filter.
     * @param {CountryFindUniqueArgs} args - Arguments to find a Country
     * @example
     * // Get one Country
     * const country = await prisma.country.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CountryFindUniqueArgs>(args: SelectSubset<T, CountryFindUniqueArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Country that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CountryFindUniqueOrThrowArgs} args - Arguments to find a Country
     * @example
     * // Get one Country
     * const country = await prisma.country.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CountryFindUniqueOrThrowArgs>(args: SelectSubset<T, CountryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Country that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CountryFindFirstArgs} args - Arguments to find a Country
     * @example
     * // Get one Country
     * const country = await prisma.country.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CountryFindFirstArgs>(args?: SelectSubset<T, CountryFindFirstArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Country that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CountryFindFirstOrThrowArgs} args - Arguments to find a Country
     * @example
     * // Get one Country
     * const country = await prisma.country.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CountryFindFirstOrThrowArgs>(args?: SelectSubset<T, CountryFindFirstOrThrowArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Countries that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CountryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Countries
     * const countries = await prisma.country.findMany()
     * 
     * // Get first 10 Countries
     * const countries = await prisma.country.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const countryWithIdOnly = await prisma.country.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CountryFindManyArgs>(args?: SelectSubset<T, CountryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Country.
     * @param {CountryCreateArgs} args - Arguments to create a Country.
     * @example
     * // Create one Country
     * const Country = await prisma.country.create({
     *   data: {
     *     // ... data to create a Country
     *   }
     * })
     * 
     */
    create<T extends CountryCreateArgs>(args: SelectSubset<T, CountryCreateArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Countries.
     * @param {CountryCreateManyArgs} args - Arguments to create many Countries.
     * @example
     * // Create many Countries
     * const country = await prisma.country.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CountryCreateManyArgs>(args?: SelectSubset<T, CountryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Countries and returns the data saved in the database.
     * @param {CountryCreateManyAndReturnArgs} args - Arguments to create many Countries.
     * @example
     * // Create many Countries
     * const country = await prisma.country.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Countries and only return the `id`
     * const countryWithIdOnly = await prisma.country.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CountryCreateManyAndReturnArgs>(args?: SelectSubset<T, CountryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Country.
     * @param {CountryDeleteArgs} args - Arguments to delete one Country.
     * @example
     * // Delete one Country
     * const Country = await prisma.country.delete({
     *   where: {
     *     // ... filter to delete one Country
     *   }
     * })
     * 
     */
    delete<T extends CountryDeleteArgs>(args: SelectSubset<T, CountryDeleteArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Country.
     * @param {CountryUpdateArgs} args - Arguments to update one Country.
     * @example
     * // Update one Country
     * const country = await prisma.country.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CountryUpdateArgs>(args: SelectSubset<T, CountryUpdateArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Countries.
     * @param {CountryDeleteManyArgs} args - Arguments to filter Countries to delete.
     * @example
     * // Delete a few Countries
     * const { count } = await prisma.country.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CountryDeleteManyArgs>(args?: SelectSubset<T, CountryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Countries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CountryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Countries
     * const country = await prisma.country.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CountryUpdateManyArgs>(args: SelectSubset<T, CountryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Countries and returns the data updated in the database.
     * @param {CountryUpdateManyAndReturnArgs} args - Arguments to update many Countries.
     * @example
     * // Update many Countries
     * const country = await prisma.country.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Countries and only return the `id`
     * const countryWithIdOnly = await prisma.country.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CountryUpdateManyAndReturnArgs>(args: SelectSubset<T, CountryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Country.
     * @param {CountryUpsertArgs} args - Arguments to update or create a Country.
     * @example
     * // Update or create a Country
     * const country = await prisma.country.upsert({
     *   create: {
     *     // ... data to create a Country
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Country we want to update
     *   }
     * })
     */
    upsert<T extends CountryUpsertArgs>(args: SelectSubset<T, CountryUpsertArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Countries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CountryCountArgs} args - Arguments to filter Countries to count.
     * @example
     * // Count the number of Countries
     * const count = await prisma.country.count({
     *   where: {
     *     // ... the filter for the Countries we want to count
     *   }
     * })
    **/
    count<T extends CountryCountArgs>(
      args?: Subset<T, CountryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CountryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Country.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CountryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CountryAggregateArgs>(args: Subset<T, CountryAggregateArgs>): Prisma.PrismaPromise<GetCountryAggregateType<T>>

    /**
     * Group by Country.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CountryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CountryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CountryGroupByArgs['orderBy'] }
        : { orderBy?: CountryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CountryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCountryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Country model
   */
  readonly fields: CountryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Country.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CountryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    cities<T extends Country$citiesArgs<ExtArgs> = {}>(args?: Subset<T, Country$citiesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Country model
   */
  interface CountryFieldRefs {
    readonly id: FieldRef<"Country", 'String'>
    readonly iso2: FieldRef<"Country", 'String'>
    readonly iso3: FieldRef<"Country", 'String'>
    readonly dialingCode: FieldRef<"Country", 'String'>
    readonly currencyCode: FieldRef<"Country", 'String'>
    readonly nameAz: FieldRef<"Country", 'String'>
    readonly nameRu: FieldRef<"Country", 'String'>
    readonly nameEn: FieldRef<"Country", 'String'>
    readonly sortOrder: FieldRef<"Country", 'Int'>
    readonly createdAt: FieldRef<"Country", 'DateTime'>
    readonly updatedAt: FieldRef<"Country", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Country findUnique
   */
  export type CountryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * Filter, which Country to fetch.
     */
    where: CountryWhereUniqueInput
  }

  /**
   * Country findUniqueOrThrow
   */
  export type CountryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * Filter, which Country to fetch.
     */
    where: CountryWhereUniqueInput
  }

  /**
   * Country findFirst
   */
  export type CountryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * Filter, which Country to fetch.
     */
    where?: CountryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Countries to fetch.
     */
    orderBy?: CountryOrderByWithRelationInput | CountryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Countries.
     */
    cursor?: CountryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Countries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Countries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Countries.
     */
    distinct?: CountryScalarFieldEnum | CountryScalarFieldEnum[]
  }

  /**
   * Country findFirstOrThrow
   */
  export type CountryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * Filter, which Country to fetch.
     */
    where?: CountryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Countries to fetch.
     */
    orderBy?: CountryOrderByWithRelationInput | CountryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Countries.
     */
    cursor?: CountryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Countries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Countries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Countries.
     */
    distinct?: CountryScalarFieldEnum | CountryScalarFieldEnum[]
  }

  /**
   * Country findMany
   */
  export type CountryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * Filter, which Countries to fetch.
     */
    where?: CountryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Countries to fetch.
     */
    orderBy?: CountryOrderByWithRelationInput | CountryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Countries.
     */
    cursor?: CountryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Countries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Countries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Countries.
     */
    distinct?: CountryScalarFieldEnum | CountryScalarFieldEnum[]
  }

  /**
   * Country create
   */
  export type CountryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * The data needed to create a Country.
     */
    data: XOR<CountryCreateInput, CountryUncheckedCreateInput>
  }

  /**
   * Country createMany
   */
  export type CountryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Countries.
     */
    data: CountryCreateManyInput | CountryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Country createManyAndReturn
   */
  export type CountryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * The data used to create many Countries.
     */
    data: CountryCreateManyInput | CountryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Country update
   */
  export type CountryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * The data needed to update a Country.
     */
    data: XOR<CountryUpdateInput, CountryUncheckedUpdateInput>
    /**
     * Choose, which Country to update.
     */
    where: CountryWhereUniqueInput
  }

  /**
   * Country updateMany
   */
  export type CountryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Countries.
     */
    data: XOR<CountryUpdateManyMutationInput, CountryUncheckedUpdateManyInput>
    /**
     * Filter which Countries to update
     */
    where?: CountryWhereInput
    /**
     * Limit how many Countries to update.
     */
    limit?: number
  }

  /**
   * Country updateManyAndReturn
   */
  export type CountryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * The data used to update Countries.
     */
    data: XOR<CountryUpdateManyMutationInput, CountryUncheckedUpdateManyInput>
    /**
     * Filter which Countries to update
     */
    where?: CountryWhereInput
    /**
     * Limit how many Countries to update.
     */
    limit?: number
  }

  /**
   * Country upsert
   */
  export type CountryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * The filter to search for the Country to update in case it exists.
     */
    where: CountryWhereUniqueInput
    /**
     * In case the Country found by the `where` argument doesn't exist, create a new Country with this data.
     */
    create: XOR<CountryCreateInput, CountryUncheckedCreateInput>
    /**
     * In case the Country was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CountryUpdateInput, CountryUncheckedUpdateInput>
  }

  /**
   * Country delete
   */
  export type CountryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
    /**
     * Filter which Country to delete.
     */
    where: CountryWhereUniqueInput
  }

  /**
   * Country deleteMany
   */
  export type CountryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Countries to delete
     */
    where?: CountryWhereInput
    /**
     * Limit how many Countries to delete.
     */
    limit?: number
  }

  /**
   * Country.cities
   */
  export type Country$citiesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    where?: CityWhereInput
    orderBy?: CityOrderByWithRelationInput | CityOrderByWithRelationInput[]
    cursor?: CityWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CityScalarFieldEnum | CityScalarFieldEnum[]
  }

  /**
   * Country without action
   */
  export type CountryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Country
     */
    select?: CountrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Country
     */
    omit?: CountryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CountryInclude<ExtArgs> | null
  }


  /**
   * Model City
   */

  export type AggregateCity = {
    _count: CityCountAggregateOutputType | null
    _avg: CityAvgAggregateOutputType | null
    _sum: CitySumAggregateOutputType | null
    _min: CityMinAggregateOutputType | null
    _max: CityMaxAggregateOutputType | null
  }

  export type CityAvgAggregateOutputType = {
    sortOrder: number | null
  }

  export type CitySumAggregateOutputType = {
    sortOrder: number | null
  }

  export type CityMinAggregateOutputType = {
    id: string | null
    code: string | null
    countryIso2: string | null
    region: string | null
    isCapital: boolean | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CityMaxAggregateOutputType = {
    id: string | null
    code: string | null
    countryIso2: string | null
    region: string | null
    isCapital: boolean | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CityCountAggregateOutputType = {
    id: number
    code: number
    countryIso2: number
    region: number
    isCapital: number
    nameAz: number
    nameRu: number
    nameEn: number
    sortOrder: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CityAvgAggregateInputType = {
    sortOrder?: true
  }

  export type CitySumAggregateInputType = {
    sortOrder?: true
  }

  export type CityMinAggregateInputType = {
    id?: true
    code?: true
    countryIso2?: true
    region?: true
    isCapital?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CityMaxAggregateInputType = {
    id?: true
    code?: true
    countryIso2?: true
    region?: true
    isCapital?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CityCountAggregateInputType = {
    id?: true
    code?: true
    countryIso2?: true
    region?: true
    isCapital?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CityAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which City to aggregate.
     */
    where?: CityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Cities to fetch.
     */
    orderBy?: CityOrderByWithRelationInput | CityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Cities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Cities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Cities
    **/
    _count?: true | CityCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CityAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CitySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CityMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CityMaxAggregateInputType
  }

  export type GetCityAggregateType<T extends CityAggregateArgs> = {
        [P in keyof T & keyof AggregateCity]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCity[P]>
      : GetScalarType<T[P], AggregateCity[P]>
  }




  export type CityGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CityWhereInput
    orderBy?: CityOrderByWithAggregationInput | CityOrderByWithAggregationInput[]
    by: CityScalarFieldEnum[] | CityScalarFieldEnum
    having?: CityScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CityCountAggregateInputType | true
    _avg?: CityAvgAggregateInputType
    _sum?: CitySumAggregateInputType
    _min?: CityMinAggregateInputType
    _max?: CityMaxAggregateInputType
  }

  export type CityGroupByOutputType = {
    id: string
    code: string
    countryIso2: string
    region: string | null
    isCapital: boolean
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder: number
    createdAt: Date
    updatedAt: Date
    _count: CityCountAggregateOutputType | null
    _avg: CityAvgAggregateOutputType | null
    _sum: CitySumAggregateOutputType | null
    _min: CityMinAggregateOutputType | null
    _max: CityMaxAggregateOutputType | null
  }

  type GetCityGroupByPayload<T extends CityGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CityGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CityGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CityGroupByOutputType[P]>
            : GetScalarType<T[P], CityGroupByOutputType[P]>
        }
      >
    >


  export type CitySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    countryIso2?: boolean
    region?: boolean
    isCapital?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    country?: boolean | CountryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["city"]>

  export type CitySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    countryIso2?: boolean
    region?: boolean
    isCapital?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    country?: boolean | CountryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["city"]>

  export type CitySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    countryIso2?: boolean
    region?: boolean
    isCapital?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    country?: boolean | CountryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["city"]>

  export type CitySelectScalar = {
    id?: boolean
    code?: boolean
    countryIso2?: boolean
    region?: boolean
    isCapital?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CityOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "code" | "countryIso2" | "region" | "isCapital" | "nameAz" | "nameRu" | "nameEn" | "sortOrder" | "createdAt" | "updatedAt", ExtArgs["result"]["city"]>
  export type CityInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    country?: boolean | CountryDefaultArgs<ExtArgs>
  }
  export type CityIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    country?: boolean | CountryDefaultArgs<ExtArgs>
  }
  export type CityIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    country?: boolean | CountryDefaultArgs<ExtArgs>
  }

  export type $CityPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "City"
    objects: {
      country: Prisma.$CountryPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      code: string
      countryIso2: string
      region: string | null
      isCapital: boolean
      nameAz: string
      nameRu: string
      nameEn: string
      sortOrder: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["city"]>
    composites: {}
  }

  type CityGetPayload<S extends boolean | null | undefined | CityDefaultArgs> = $Result.GetResult<Prisma.$CityPayload, S>

  type CityCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CityFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CityCountAggregateInputType | true
    }

  export interface CityDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['City'], meta: { name: 'City' } }
    /**
     * Find zero or one City that matches the filter.
     * @param {CityFindUniqueArgs} args - Arguments to find a City
     * @example
     * // Get one City
     * const city = await prisma.city.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CityFindUniqueArgs>(args: SelectSubset<T, CityFindUniqueArgs<ExtArgs>>): Prisma__CityClient<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one City that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CityFindUniqueOrThrowArgs} args - Arguments to find a City
     * @example
     * // Get one City
     * const city = await prisma.city.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CityFindUniqueOrThrowArgs>(args: SelectSubset<T, CityFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CityClient<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first City that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CityFindFirstArgs} args - Arguments to find a City
     * @example
     * // Get one City
     * const city = await prisma.city.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CityFindFirstArgs>(args?: SelectSubset<T, CityFindFirstArgs<ExtArgs>>): Prisma__CityClient<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first City that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CityFindFirstOrThrowArgs} args - Arguments to find a City
     * @example
     * // Get one City
     * const city = await prisma.city.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CityFindFirstOrThrowArgs>(args?: SelectSubset<T, CityFindFirstOrThrowArgs<ExtArgs>>): Prisma__CityClient<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Cities that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CityFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Cities
     * const cities = await prisma.city.findMany()
     * 
     * // Get first 10 Cities
     * const cities = await prisma.city.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const cityWithIdOnly = await prisma.city.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CityFindManyArgs>(args?: SelectSubset<T, CityFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a City.
     * @param {CityCreateArgs} args - Arguments to create a City.
     * @example
     * // Create one City
     * const City = await prisma.city.create({
     *   data: {
     *     // ... data to create a City
     *   }
     * })
     * 
     */
    create<T extends CityCreateArgs>(args: SelectSubset<T, CityCreateArgs<ExtArgs>>): Prisma__CityClient<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Cities.
     * @param {CityCreateManyArgs} args - Arguments to create many Cities.
     * @example
     * // Create many Cities
     * const city = await prisma.city.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CityCreateManyArgs>(args?: SelectSubset<T, CityCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Cities and returns the data saved in the database.
     * @param {CityCreateManyAndReturnArgs} args - Arguments to create many Cities.
     * @example
     * // Create many Cities
     * const city = await prisma.city.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Cities and only return the `id`
     * const cityWithIdOnly = await prisma.city.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CityCreateManyAndReturnArgs>(args?: SelectSubset<T, CityCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a City.
     * @param {CityDeleteArgs} args - Arguments to delete one City.
     * @example
     * // Delete one City
     * const City = await prisma.city.delete({
     *   where: {
     *     // ... filter to delete one City
     *   }
     * })
     * 
     */
    delete<T extends CityDeleteArgs>(args: SelectSubset<T, CityDeleteArgs<ExtArgs>>): Prisma__CityClient<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one City.
     * @param {CityUpdateArgs} args - Arguments to update one City.
     * @example
     * // Update one City
     * const city = await prisma.city.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CityUpdateArgs>(args: SelectSubset<T, CityUpdateArgs<ExtArgs>>): Prisma__CityClient<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Cities.
     * @param {CityDeleteManyArgs} args - Arguments to filter Cities to delete.
     * @example
     * // Delete a few Cities
     * const { count } = await prisma.city.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CityDeleteManyArgs>(args?: SelectSubset<T, CityDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Cities.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CityUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Cities
     * const city = await prisma.city.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CityUpdateManyArgs>(args: SelectSubset<T, CityUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Cities and returns the data updated in the database.
     * @param {CityUpdateManyAndReturnArgs} args - Arguments to update many Cities.
     * @example
     * // Update many Cities
     * const city = await prisma.city.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Cities and only return the `id`
     * const cityWithIdOnly = await prisma.city.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CityUpdateManyAndReturnArgs>(args: SelectSubset<T, CityUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one City.
     * @param {CityUpsertArgs} args - Arguments to update or create a City.
     * @example
     * // Update or create a City
     * const city = await prisma.city.upsert({
     *   create: {
     *     // ... data to create a City
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the City we want to update
     *   }
     * })
     */
    upsert<T extends CityUpsertArgs>(args: SelectSubset<T, CityUpsertArgs<ExtArgs>>): Prisma__CityClient<$Result.GetResult<Prisma.$CityPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Cities.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CityCountArgs} args - Arguments to filter Cities to count.
     * @example
     * // Count the number of Cities
     * const count = await prisma.city.count({
     *   where: {
     *     // ... the filter for the Cities we want to count
     *   }
     * })
    **/
    count<T extends CityCountArgs>(
      args?: Subset<T, CityCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CityCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a City.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CityAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CityAggregateArgs>(args: Subset<T, CityAggregateArgs>): Prisma.PrismaPromise<GetCityAggregateType<T>>

    /**
     * Group by City.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CityGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CityGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CityGroupByArgs['orderBy'] }
        : { orderBy?: CityGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CityGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCityGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the City model
   */
  readonly fields: CityFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for City.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CityClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    country<T extends CountryDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CountryDefaultArgs<ExtArgs>>): Prisma__CountryClient<$Result.GetResult<Prisma.$CountryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the City model
   */
  interface CityFieldRefs {
    readonly id: FieldRef<"City", 'String'>
    readonly code: FieldRef<"City", 'String'>
    readonly countryIso2: FieldRef<"City", 'String'>
    readonly region: FieldRef<"City", 'String'>
    readonly isCapital: FieldRef<"City", 'Boolean'>
    readonly nameAz: FieldRef<"City", 'String'>
    readonly nameRu: FieldRef<"City", 'String'>
    readonly nameEn: FieldRef<"City", 'String'>
    readonly sortOrder: FieldRef<"City", 'Int'>
    readonly createdAt: FieldRef<"City", 'DateTime'>
    readonly updatedAt: FieldRef<"City", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * City findUnique
   */
  export type CityFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * Filter, which City to fetch.
     */
    where: CityWhereUniqueInput
  }

  /**
   * City findUniqueOrThrow
   */
  export type CityFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * Filter, which City to fetch.
     */
    where: CityWhereUniqueInput
  }

  /**
   * City findFirst
   */
  export type CityFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * Filter, which City to fetch.
     */
    where?: CityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Cities to fetch.
     */
    orderBy?: CityOrderByWithRelationInput | CityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Cities.
     */
    cursor?: CityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Cities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Cities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Cities.
     */
    distinct?: CityScalarFieldEnum | CityScalarFieldEnum[]
  }

  /**
   * City findFirstOrThrow
   */
  export type CityFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * Filter, which City to fetch.
     */
    where?: CityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Cities to fetch.
     */
    orderBy?: CityOrderByWithRelationInput | CityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Cities.
     */
    cursor?: CityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Cities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Cities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Cities.
     */
    distinct?: CityScalarFieldEnum | CityScalarFieldEnum[]
  }

  /**
   * City findMany
   */
  export type CityFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * Filter, which Cities to fetch.
     */
    where?: CityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Cities to fetch.
     */
    orderBy?: CityOrderByWithRelationInput | CityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Cities.
     */
    cursor?: CityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Cities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Cities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Cities.
     */
    distinct?: CityScalarFieldEnum | CityScalarFieldEnum[]
  }

  /**
   * City create
   */
  export type CityCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * The data needed to create a City.
     */
    data: XOR<CityCreateInput, CityUncheckedCreateInput>
  }

  /**
   * City createMany
   */
  export type CityCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Cities.
     */
    data: CityCreateManyInput | CityCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * City createManyAndReturn
   */
  export type CityCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * The data used to create many Cities.
     */
    data: CityCreateManyInput | CityCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * City update
   */
  export type CityUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * The data needed to update a City.
     */
    data: XOR<CityUpdateInput, CityUncheckedUpdateInput>
    /**
     * Choose, which City to update.
     */
    where: CityWhereUniqueInput
  }

  /**
   * City updateMany
   */
  export type CityUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Cities.
     */
    data: XOR<CityUpdateManyMutationInput, CityUncheckedUpdateManyInput>
    /**
     * Filter which Cities to update
     */
    where?: CityWhereInput
    /**
     * Limit how many Cities to update.
     */
    limit?: number
  }

  /**
   * City updateManyAndReturn
   */
  export type CityUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * The data used to update Cities.
     */
    data: XOR<CityUpdateManyMutationInput, CityUncheckedUpdateManyInput>
    /**
     * Filter which Cities to update
     */
    where?: CityWhereInput
    /**
     * Limit how many Cities to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * City upsert
   */
  export type CityUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * The filter to search for the City to update in case it exists.
     */
    where: CityWhereUniqueInput
    /**
     * In case the City found by the `where` argument doesn't exist, create a new City with this data.
     */
    create: XOR<CityCreateInput, CityUncheckedCreateInput>
    /**
     * In case the City was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CityUpdateInput, CityUncheckedUpdateInput>
  }

  /**
   * City delete
   */
  export type CityDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
    /**
     * Filter which City to delete.
     */
    where: CityWhereUniqueInput
  }

  /**
   * City deleteMany
   */
  export type CityDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Cities to delete
     */
    where?: CityWhereInput
    /**
     * Limit how many Cities to delete.
     */
    limit?: number
  }

  /**
   * City without action
   */
  export type CityDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the City
     */
    select?: CitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the City
     */
    omit?: CityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CityInclude<ExtArgs> | null
  }


  /**
   * Model TaxRate
   */

  export type AggregateTaxRate = {
    _count: TaxRateCountAggregateOutputType | null
    _avg: TaxRateAvgAggregateOutputType | null
    _sum: TaxRateSumAggregateOutputType | null
    _min: TaxRateMinAggregateOutputType | null
    _max: TaxRateMaxAggregateOutputType | null
  }

  export type TaxRateAvgAggregateOutputType = {
    percent: Decimal | null
    sortOrder: number | null
  }

  export type TaxRateSumAggregateOutputType = {
    percent: Decimal | null
    sortOrder: number | null
  }

  export type TaxRateMinAggregateOutputType = {
    id: string | null
    code: string | null
    kind: $Enums.TaxRateKind | null
    region: string | null
    percent: Decimal | null
    effectiveFrom: Date | null
    effectiveTo: Date | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    sortOrder: number | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TaxRateMaxAggregateOutputType = {
    id: string | null
    code: string | null
    kind: $Enums.TaxRateKind | null
    region: string | null
    percent: Decimal | null
    effectiveFrom: Date | null
    effectiveTo: Date | null
    nameAz: string | null
    nameRu: string | null
    nameEn: string | null
    sortOrder: number | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TaxRateCountAggregateOutputType = {
    id: number
    code: number
    kind: number
    region: number
    percent: number
    effectiveFrom: number
    effectiveTo: number
    nameAz: number
    nameRu: number
    nameEn: number
    sortOrder: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TaxRateAvgAggregateInputType = {
    percent?: true
    sortOrder?: true
  }

  export type TaxRateSumAggregateInputType = {
    percent?: true
    sortOrder?: true
  }

  export type TaxRateMinAggregateInputType = {
    id?: true
    code?: true
    kind?: true
    region?: true
    percent?: true
    effectiveFrom?: true
    effectiveTo?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TaxRateMaxAggregateInputType = {
    id?: true
    code?: true
    kind?: true
    region?: true
    percent?: true
    effectiveFrom?: true
    effectiveTo?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TaxRateCountAggregateInputType = {
    id?: true
    code?: true
    kind?: true
    region?: true
    percent?: true
    effectiveFrom?: true
    effectiveTo?: true
    nameAz?: true
    nameRu?: true
    nameEn?: true
    sortOrder?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TaxRateAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TaxRate to aggregate.
     */
    where?: TaxRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TaxRates to fetch.
     */
    orderBy?: TaxRateOrderByWithRelationInput | TaxRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TaxRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TaxRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TaxRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TaxRates
    **/
    _count?: true | TaxRateCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TaxRateAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TaxRateSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TaxRateMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TaxRateMaxAggregateInputType
  }

  export type GetTaxRateAggregateType<T extends TaxRateAggregateArgs> = {
        [P in keyof T & keyof AggregateTaxRate]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTaxRate[P]>
      : GetScalarType<T[P], AggregateTaxRate[P]>
  }




  export type TaxRateGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TaxRateWhereInput
    orderBy?: TaxRateOrderByWithAggregationInput | TaxRateOrderByWithAggregationInput[]
    by: TaxRateScalarFieldEnum[] | TaxRateScalarFieldEnum
    having?: TaxRateScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TaxRateCountAggregateInputType | true
    _avg?: TaxRateAvgAggregateInputType
    _sum?: TaxRateSumAggregateInputType
    _min?: TaxRateMinAggregateInputType
    _max?: TaxRateMaxAggregateInputType
  }

  export type TaxRateGroupByOutputType = {
    id: string
    code: string
    kind: $Enums.TaxRateKind
    region: string
    percent: Decimal
    effectiveFrom: Date
    effectiveTo: Date | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: TaxRateCountAggregateOutputType | null
    _avg: TaxRateAvgAggregateOutputType | null
    _sum: TaxRateSumAggregateOutputType | null
    _min: TaxRateMinAggregateOutputType | null
    _max: TaxRateMaxAggregateOutputType | null
  }

  type GetTaxRateGroupByPayload<T extends TaxRateGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TaxRateGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TaxRateGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TaxRateGroupByOutputType[P]>
            : GetScalarType<T[P], TaxRateGroupByOutputType[P]>
        }
      >
    >


  export type TaxRateSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    kind?: boolean
    region?: boolean
    percent?: boolean
    effectiveFrom?: boolean
    effectiveTo?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["taxRate"]>

  export type TaxRateSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    kind?: boolean
    region?: boolean
    percent?: boolean
    effectiveFrom?: boolean
    effectiveTo?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["taxRate"]>

  export type TaxRateSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    code?: boolean
    kind?: boolean
    region?: boolean
    percent?: boolean
    effectiveFrom?: boolean
    effectiveTo?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["taxRate"]>

  export type TaxRateSelectScalar = {
    id?: boolean
    code?: boolean
    kind?: boolean
    region?: boolean
    percent?: boolean
    effectiveFrom?: boolean
    effectiveTo?: boolean
    nameAz?: boolean
    nameRu?: boolean
    nameEn?: boolean
    sortOrder?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TaxRateOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "code" | "kind" | "region" | "percent" | "effectiveFrom" | "effectiveTo" | "nameAz" | "nameRu" | "nameEn" | "sortOrder" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["taxRate"]>

  export type $TaxRatePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TaxRate"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      code: string
      kind: $Enums.TaxRateKind
      region: string
      percent: Prisma.Decimal
      effectiveFrom: Date
      effectiveTo: Date | null
      nameAz: string
      nameRu: string
      nameEn: string
      sortOrder: number
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["taxRate"]>
    composites: {}
  }

  type TaxRateGetPayload<S extends boolean | null | undefined | TaxRateDefaultArgs> = $Result.GetResult<Prisma.$TaxRatePayload, S>

  type TaxRateCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TaxRateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TaxRateCountAggregateInputType | true
    }

  export interface TaxRateDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TaxRate'], meta: { name: 'TaxRate' } }
    /**
     * Find zero or one TaxRate that matches the filter.
     * @param {TaxRateFindUniqueArgs} args - Arguments to find a TaxRate
     * @example
     * // Get one TaxRate
     * const taxRate = await prisma.taxRate.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TaxRateFindUniqueArgs>(args: SelectSubset<T, TaxRateFindUniqueArgs<ExtArgs>>): Prisma__TaxRateClient<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TaxRate that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TaxRateFindUniqueOrThrowArgs} args - Arguments to find a TaxRate
     * @example
     * // Get one TaxRate
     * const taxRate = await prisma.taxRate.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TaxRateFindUniqueOrThrowArgs>(args: SelectSubset<T, TaxRateFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TaxRateClient<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TaxRate that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TaxRateFindFirstArgs} args - Arguments to find a TaxRate
     * @example
     * // Get one TaxRate
     * const taxRate = await prisma.taxRate.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TaxRateFindFirstArgs>(args?: SelectSubset<T, TaxRateFindFirstArgs<ExtArgs>>): Prisma__TaxRateClient<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TaxRate that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TaxRateFindFirstOrThrowArgs} args - Arguments to find a TaxRate
     * @example
     * // Get one TaxRate
     * const taxRate = await prisma.taxRate.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TaxRateFindFirstOrThrowArgs>(args?: SelectSubset<T, TaxRateFindFirstOrThrowArgs<ExtArgs>>): Prisma__TaxRateClient<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TaxRates that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TaxRateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TaxRates
     * const taxRates = await prisma.taxRate.findMany()
     * 
     * // Get first 10 TaxRates
     * const taxRates = await prisma.taxRate.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const taxRateWithIdOnly = await prisma.taxRate.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TaxRateFindManyArgs>(args?: SelectSubset<T, TaxRateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TaxRate.
     * @param {TaxRateCreateArgs} args - Arguments to create a TaxRate.
     * @example
     * // Create one TaxRate
     * const TaxRate = await prisma.taxRate.create({
     *   data: {
     *     // ... data to create a TaxRate
     *   }
     * })
     * 
     */
    create<T extends TaxRateCreateArgs>(args: SelectSubset<T, TaxRateCreateArgs<ExtArgs>>): Prisma__TaxRateClient<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TaxRates.
     * @param {TaxRateCreateManyArgs} args - Arguments to create many TaxRates.
     * @example
     * // Create many TaxRates
     * const taxRate = await prisma.taxRate.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TaxRateCreateManyArgs>(args?: SelectSubset<T, TaxRateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TaxRates and returns the data saved in the database.
     * @param {TaxRateCreateManyAndReturnArgs} args - Arguments to create many TaxRates.
     * @example
     * // Create many TaxRates
     * const taxRate = await prisma.taxRate.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TaxRates and only return the `id`
     * const taxRateWithIdOnly = await prisma.taxRate.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TaxRateCreateManyAndReturnArgs>(args?: SelectSubset<T, TaxRateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TaxRate.
     * @param {TaxRateDeleteArgs} args - Arguments to delete one TaxRate.
     * @example
     * // Delete one TaxRate
     * const TaxRate = await prisma.taxRate.delete({
     *   where: {
     *     // ... filter to delete one TaxRate
     *   }
     * })
     * 
     */
    delete<T extends TaxRateDeleteArgs>(args: SelectSubset<T, TaxRateDeleteArgs<ExtArgs>>): Prisma__TaxRateClient<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TaxRate.
     * @param {TaxRateUpdateArgs} args - Arguments to update one TaxRate.
     * @example
     * // Update one TaxRate
     * const taxRate = await prisma.taxRate.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TaxRateUpdateArgs>(args: SelectSubset<T, TaxRateUpdateArgs<ExtArgs>>): Prisma__TaxRateClient<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TaxRates.
     * @param {TaxRateDeleteManyArgs} args - Arguments to filter TaxRates to delete.
     * @example
     * // Delete a few TaxRates
     * const { count } = await prisma.taxRate.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TaxRateDeleteManyArgs>(args?: SelectSubset<T, TaxRateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TaxRates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TaxRateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TaxRates
     * const taxRate = await prisma.taxRate.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TaxRateUpdateManyArgs>(args: SelectSubset<T, TaxRateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TaxRates and returns the data updated in the database.
     * @param {TaxRateUpdateManyAndReturnArgs} args - Arguments to update many TaxRates.
     * @example
     * // Update many TaxRates
     * const taxRate = await prisma.taxRate.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TaxRates and only return the `id`
     * const taxRateWithIdOnly = await prisma.taxRate.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TaxRateUpdateManyAndReturnArgs>(args: SelectSubset<T, TaxRateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TaxRate.
     * @param {TaxRateUpsertArgs} args - Arguments to update or create a TaxRate.
     * @example
     * // Update or create a TaxRate
     * const taxRate = await prisma.taxRate.upsert({
     *   create: {
     *     // ... data to create a TaxRate
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TaxRate we want to update
     *   }
     * })
     */
    upsert<T extends TaxRateUpsertArgs>(args: SelectSubset<T, TaxRateUpsertArgs<ExtArgs>>): Prisma__TaxRateClient<$Result.GetResult<Prisma.$TaxRatePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TaxRates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TaxRateCountArgs} args - Arguments to filter TaxRates to count.
     * @example
     * // Count the number of TaxRates
     * const count = await prisma.taxRate.count({
     *   where: {
     *     // ... the filter for the TaxRates we want to count
     *   }
     * })
    **/
    count<T extends TaxRateCountArgs>(
      args?: Subset<T, TaxRateCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TaxRateCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TaxRate.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TaxRateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TaxRateAggregateArgs>(args: Subset<T, TaxRateAggregateArgs>): Prisma.PrismaPromise<GetTaxRateAggregateType<T>>

    /**
     * Group by TaxRate.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TaxRateGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TaxRateGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TaxRateGroupByArgs['orderBy'] }
        : { orderBy?: TaxRateGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TaxRateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTaxRateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TaxRate model
   */
  readonly fields: TaxRateFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TaxRate.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TaxRateClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TaxRate model
   */
  interface TaxRateFieldRefs {
    readonly id: FieldRef<"TaxRate", 'String'>
    readonly code: FieldRef<"TaxRate", 'String'>
    readonly kind: FieldRef<"TaxRate", 'TaxRateKind'>
    readonly region: FieldRef<"TaxRate", 'String'>
    readonly percent: FieldRef<"TaxRate", 'Decimal'>
    readonly effectiveFrom: FieldRef<"TaxRate", 'DateTime'>
    readonly effectiveTo: FieldRef<"TaxRate", 'DateTime'>
    readonly nameAz: FieldRef<"TaxRate", 'String'>
    readonly nameRu: FieldRef<"TaxRate", 'String'>
    readonly nameEn: FieldRef<"TaxRate", 'String'>
    readonly sortOrder: FieldRef<"TaxRate", 'Int'>
    readonly isActive: FieldRef<"TaxRate", 'Boolean'>
    readonly createdAt: FieldRef<"TaxRate", 'DateTime'>
    readonly updatedAt: FieldRef<"TaxRate", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TaxRate findUnique
   */
  export type TaxRateFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * Filter, which TaxRate to fetch.
     */
    where: TaxRateWhereUniqueInput
  }

  /**
   * TaxRate findUniqueOrThrow
   */
  export type TaxRateFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * Filter, which TaxRate to fetch.
     */
    where: TaxRateWhereUniqueInput
  }

  /**
   * TaxRate findFirst
   */
  export type TaxRateFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * Filter, which TaxRate to fetch.
     */
    where?: TaxRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TaxRates to fetch.
     */
    orderBy?: TaxRateOrderByWithRelationInput | TaxRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TaxRates.
     */
    cursor?: TaxRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TaxRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TaxRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TaxRates.
     */
    distinct?: TaxRateScalarFieldEnum | TaxRateScalarFieldEnum[]
  }

  /**
   * TaxRate findFirstOrThrow
   */
  export type TaxRateFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * Filter, which TaxRate to fetch.
     */
    where?: TaxRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TaxRates to fetch.
     */
    orderBy?: TaxRateOrderByWithRelationInput | TaxRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TaxRates.
     */
    cursor?: TaxRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TaxRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TaxRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TaxRates.
     */
    distinct?: TaxRateScalarFieldEnum | TaxRateScalarFieldEnum[]
  }

  /**
   * TaxRate findMany
   */
  export type TaxRateFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * Filter, which TaxRates to fetch.
     */
    where?: TaxRateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TaxRates to fetch.
     */
    orderBy?: TaxRateOrderByWithRelationInput | TaxRateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TaxRates.
     */
    cursor?: TaxRateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TaxRates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TaxRates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TaxRates.
     */
    distinct?: TaxRateScalarFieldEnum | TaxRateScalarFieldEnum[]
  }

  /**
   * TaxRate create
   */
  export type TaxRateCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * The data needed to create a TaxRate.
     */
    data: XOR<TaxRateCreateInput, TaxRateUncheckedCreateInput>
  }

  /**
   * TaxRate createMany
   */
  export type TaxRateCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TaxRates.
     */
    data: TaxRateCreateManyInput | TaxRateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TaxRate createManyAndReturn
   */
  export type TaxRateCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * The data used to create many TaxRates.
     */
    data: TaxRateCreateManyInput | TaxRateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TaxRate update
   */
  export type TaxRateUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * The data needed to update a TaxRate.
     */
    data: XOR<TaxRateUpdateInput, TaxRateUncheckedUpdateInput>
    /**
     * Choose, which TaxRate to update.
     */
    where: TaxRateWhereUniqueInput
  }

  /**
   * TaxRate updateMany
   */
  export type TaxRateUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TaxRates.
     */
    data: XOR<TaxRateUpdateManyMutationInput, TaxRateUncheckedUpdateManyInput>
    /**
     * Filter which TaxRates to update
     */
    where?: TaxRateWhereInput
    /**
     * Limit how many TaxRates to update.
     */
    limit?: number
  }

  /**
   * TaxRate updateManyAndReturn
   */
  export type TaxRateUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * The data used to update TaxRates.
     */
    data: XOR<TaxRateUpdateManyMutationInput, TaxRateUncheckedUpdateManyInput>
    /**
     * Filter which TaxRates to update
     */
    where?: TaxRateWhereInput
    /**
     * Limit how many TaxRates to update.
     */
    limit?: number
  }

  /**
   * TaxRate upsert
   */
  export type TaxRateUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * The filter to search for the TaxRate to update in case it exists.
     */
    where: TaxRateWhereUniqueInput
    /**
     * In case the TaxRate found by the `where` argument doesn't exist, create a new TaxRate with this data.
     */
    create: XOR<TaxRateCreateInput, TaxRateUncheckedCreateInput>
    /**
     * In case the TaxRate was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TaxRateUpdateInput, TaxRateUncheckedUpdateInput>
  }

  /**
   * TaxRate delete
   */
  export type TaxRateDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
    /**
     * Filter which TaxRate to delete.
     */
    where: TaxRateWhereUniqueInput
  }

  /**
   * TaxRate deleteMany
   */
  export type TaxRateDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TaxRates to delete
     */
    where?: TaxRateWhereInput
    /**
     * Limit how many TaxRates to delete.
     */
    limit?: number
  }

  /**
   * TaxRate without action
   */
  export type TaxRateDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TaxRate
     */
    select?: TaxRateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TaxRate
     */
    omit?: TaxRateOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const CalendarDayScalarFieldEnum: {
    id: 'id',
    country: 'country',
    date: 'date',
    isWorking: 'isWorking',
    dayType: 'dayType',
    labelAz: 'labelAz',
    labelRu: 'labelRu',
    labelEn: 'labelEn',
    source: 'source',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CalendarDayScalarFieldEnum = (typeof CalendarDayScalarFieldEnum)[keyof typeof CalendarDayScalarFieldEnum]


  export const CbarOfficialRateScalarFieldEnum: {
    id: 'id',
    rateDate: 'rateDate',
    currencyCode: 'currencyCode',
    value: 'value',
    nominal: 'nominal',
    rate: 'rate',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CbarOfficialRateScalarFieldEnum = (typeof CbarOfficialRateScalarFieldEnum)[keyof typeof CbarOfficialRateScalarFieldEnum]


  export const GlobalCompanyDirectoryScalarFieldEnum: {
    id: 'id',
    taxId: 'taxId',
    name: 'name',
    legalForm: 'legalForm',
    legalAddress: 'legalAddress',
    phone: 'phone',
    directorName: 'directorName',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type GlobalCompanyDirectoryScalarFieldEnum = (typeof GlobalCompanyDirectoryScalarFieldEnum)[keyof typeof GlobalCompanyDirectoryScalarFieldEnum]


  export const BankGlossaryScalarFieldEnum: {
    id: 'id',
    nameAz: 'nameAz',
    voen: 'voen',
    code: 'code',
    correspondentIban: 'correspondentIban',
    swift: 'swift',
    headPhones: 'headPhones',
    headAddress: 'headAddress',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type BankGlossaryScalarFieldEnum = (typeof BankGlossaryScalarFieldEnum)[keyof typeof BankGlossaryScalarFieldEnum]


  export const BankBranchScalarFieldEnum: {
    id: 'id',
    bankId: 'bankId',
    branchCode: 'branchCode',
    name: 'name',
    swift: 'swift',
    address: 'address',
    phones: 'phones',
    isHeadOffice: 'isHeadOffice',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type BankBranchScalarFieldEnum = (typeof BankBranchScalarFieldEnum)[keyof typeof BankBranchScalarFieldEnum]


  export const CustomsTariffRateScalarFieldEnum: {
    id: 'id',
    hsCode: 'hsCode',
    description: 'description',
    dutyRatePercent: 'dutyRatePercent',
    vatRatePercent: 'vatRatePercent',
    excisePercent: 'excisePercent',
    effectiveFrom: 'effectiveFrom',
    effectiveTo: 'effectiveTo',
    notes: 'notes',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CustomsTariffRateScalarFieldEnum = (typeof CustomsTariffRateScalarFieldEnum)[keyof typeof CustomsTariffRateScalarFieldEnum]


  export const UnitOfMeasureScalarFieldEnum: {
    id: 'id',
    code: 'code',
    kind: 'kind',
    baseCode: 'baseCode',
    factor: 'factor',
    nameAz: 'nameAz',
    nameRu: 'nameRu',
    nameEn: 'nameEn',
    isActive: 'isActive',
    sortOrder: 'sortOrder',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UnitOfMeasureScalarFieldEnum = (typeof UnitOfMeasureScalarFieldEnum)[keyof typeof UnitOfMeasureScalarFieldEnum]


  export const CurrencyScalarFieldEnum: {
    id: 'id',
    code: 'code',
    symbol: 'symbol',
    decimals: 'decimals',
    nameAz: 'nameAz',
    nameRu: 'nameRu',
    nameEn: 'nameEn',
    isActive: 'isActive',
    sortOrder: 'sortOrder',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CurrencyScalarFieldEnum = (typeof CurrencyScalarFieldEnum)[keyof typeof CurrencyScalarFieldEnum]


  export const CountryScalarFieldEnum: {
    id: 'id',
    iso2: 'iso2',
    iso3: 'iso3',
    dialingCode: 'dialingCode',
    currencyCode: 'currencyCode',
    nameAz: 'nameAz',
    nameRu: 'nameRu',
    nameEn: 'nameEn',
    sortOrder: 'sortOrder',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CountryScalarFieldEnum = (typeof CountryScalarFieldEnum)[keyof typeof CountryScalarFieldEnum]


  export const CityScalarFieldEnum: {
    id: 'id',
    code: 'code',
    countryIso2: 'countryIso2',
    region: 'region',
    isCapital: 'isCapital',
    nameAz: 'nameAz',
    nameRu: 'nameRu',
    nameEn: 'nameEn',
    sortOrder: 'sortOrder',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CityScalarFieldEnum = (typeof CityScalarFieldEnum)[keyof typeof CityScalarFieldEnum]


  export const TaxRateScalarFieldEnum: {
    id: 'id',
    code: 'code',
    kind: 'kind',
    region: 'region',
    percent: 'percent',
    effectiveFrom: 'effectiveFrom',
    effectiveTo: 'effectiveTo',
    nameAz: 'nameAz',
    nameRu: 'nameRu',
    nameEn: 'nameEn',
    sortOrder: 'sortOrder',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TaxRateScalarFieldEnum = (typeof TaxRateScalarFieldEnum)[keyof typeof TaxRateScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'CbarRateStatus'
   */
  export type EnumCbarRateStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'CbarRateStatus'>
    


  /**
   * Reference to a field of type 'CbarRateStatus[]'
   */
  export type ListEnumCbarRateStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'CbarRateStatus[]'>
    


  /**
   * Reference to a field of type 'CounterpartyLegalForm'
   */
  export type EnumCounterpartyLegalFormFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'CounterpartyLegalForm'>
    


  /**
   * Reference to a field of type 'CounterpartyLegalForm[]'
   */
  export type ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'CounterpartyLegalForm[]'>
    


  /**
   * Reference to a field of type 'UnitOfMeasureKind'
   */
  export type EnumUnitOfMeasureKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UnitOfMeasureKind'>
    


  /**
   * Reference to a field of type 'UnitOfMeasureKind[]'
   */
  export type ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UnitOfMeasureKind[]'>
    


  /**
   * Reference to a field of type 'TaxRateKind'
   */
  export type EnumTaxRateKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'TaxRateKind'>
    


  /**
   * Reference to a field of type 'TaxRateKind[]'
   */
  export type ListEnumTaxRateKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'TaxRateKind[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type CalendarDayWhereInput = {
    AND?: CalendarDayWhereInput | CalendarDayWhereInput[]
    OR?: CalendarDayWhereInput[]
    NOT?: CalendarDayWhereInput | CalendarDayWhereInput[]
    id?: UuidFilter<"CalendarDay"> | string
    country?: StringFilter<"CalendarDay"> | string
    date?: DateTimeFilter<"CalendarDay"> | Date | string
    isWorking?: BoolFilter<"CalendarDay"> | boolean
    dayType?: StringFilter<"CalendarDay"> | string
    labelAz?: StringNullableFilter<"CalendarDay"> | string | null
    labelRu?: StringNullableFilter<"CalendarDay"> | string | null
    labelEn?: StringNullableFilter<"CalendarDay"> | string | null
    source?: StringFilter<"CalendarDay"> | string
    createdAt?: DateTimeFilter<"CalendarDay"> | Date | string
    updatedAt?: DateTimeFilter<"CalendarDay"> | Date | string
  }

  export type CalendarDayOrderByWithRelationInput = {
    id?: SortOrder
    country?: SortOrder
    date?: SortOrder
    isWorking?: SortOrder
    dayType?: SortOrder
    labelAz?: SortOrderInput | SortOrder
    labelRu?: SortOrderInput | SortOrder
    labelEn?: SortOrderInput | SortOrder
    source?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CalendarDayWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    country_date?: CalendarDayCountryDateCompoundUniqueInput
    AND?: CalendarDayWhereInput | CalendarDayWhereInput[]
    OR?: CalendarDayWhereInput[]
    NOT?: CalendarDayWhereInput | CalendarDayWhereInput[]
    country?: StringFilter<"CalendarDay"> | string
    date?: DateTimeFilter<"CalendarDay"> | Date | string
    isWorking?: BoolFilter<"CalendarDay"> | boolean
    dayType?: StringFilter<"CalendarDay"> | string
    labelAz?: StringNullableFilter<"CalendarDay"> | string | null
    labelRu?: StringNullableFilter<"CalendarDay"> | string | null
    labelEn?: StringNullableFilter<"CalendarDay"> | string | null
    source?: StringFilter<"CalendarDay"> | string
    createdAt?: DateTimeFilter<"CalendarDay"> | Date | string
    updatedAt?: DateTimeFilter<"CalendarDay"> | Date | string
  }, "id" | "country_date">

  export type CalendarDayOrderByWithAggregationInput = {
    id?: SortOrder
    country?: SortOrder
    date?: SortOrder
    isWorking?: SortOrder
    dayType?: SortOrder
    labelAz?: SortOrderInput | SortOrder
    labelRu?: SortOrderInput | SortOrder
    labelEn?: SortOrderInput | SortOrder
    source?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CalendarDayCountOrderByAggregateInput
    _max?: CalendarDayMaxOrderByAggregateInput
    _min?: CalendarDayMinOrderByAggregateInput
  }

  export type CalendarDayScalarWhereWithAggregatesInput = {
    AND?: CalendarDayScalarWhereWithAggregatesInput | CalendarDayScalarWhereWithAggregatesInput[]
    OR?: CalendarDayScalarWhereWithAggregatesInput[]
    NOT?: CalendarDayScalarWhereWithAggregatesInput | CalendarDayScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"CalendarDay"> | string
    country?: StringWithAggregatesFilter<"CalendarDay"> | string
    date?: DateTimeWithAggregatesFilter<"CalendarDay"> | Date | string
    isWorking?: BoolWithAggregatesFilter<"CalendarDay"> | boolean
    dayType?: StringWithAggregatesFilter<"CalendarDay"> | string
    labelAz?: StringNullableWithAggregatesFilter<"CalendarDay"> | string | null
    labelRu?: StringNullableWithAggregatesFilter<"CalendarDay"> | string | null
    labelEn?: StringNullableWithAggregatesFilter<"CalendarDay"> | string | null
    source?: StringWithAggregatesFilter<"CalendarDay"> | string
    createdAt?: DateTimeWithAggregatesFilter<"CalendarDay"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CalendarDay"> | Date | string
  }

  export type CbarOfficialRateWhereInput = {
    AND?: CbarOfficialRateWhereInput | CbarOfficialRateWhereInput[]
    OR?: CbarOfficialRateWhereInput[]
    NOT?: CbarOfficialRateWhereInput | CbarOfficialRateWhereInput[]
    id?: UuidFilter<"CbarOfficialRate"> | string
    rateDate?: DateTimeFilter<"CbarOfficialRate"> | Date | string
    currencyCode?: StringFilter<"CbarOfficialRate"> | string
    value?: DecimalFilter<"CbarOfficialRate"> | Decimal | DecimalJsLike | number | string
    nominal?: IntFilter<"CbarOfficialRate"> | number
    rate?: DecimalFilter<"CbarOfficialRate"> | Decimal | DecimalJsLike | number | string
    status?: EnumCbarRateStatusFilter<"CbarOfficialRate"> | $Enums.CbarRateStatus
    createdAt?: DateTimeFilter<"CbarOfficialRate"> | Date | string
    updatedAt?: DateTimeFilter<"CbarOfficialRate"> | Date | string
  }

  export type CbarOfficialRateOrderByWithRelationInput = {
    id?: SortOrder
    rateDate?: SortOrder
    currencyCode?: SortOrder
    value?: SortOrder
    nominal?: SortOrder
    rate?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CbarOfficialRateWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    rateDate_currencyCode?: CbarOfficialRateRateDateCurrencyCodeCompoundUniqueInput
    AND?: CbarOfficialRateWhereInput | CbarOfficialRateWhereInput[]
    OR?: CbarOfficialRateWhereInput[]
    NOT?: CbarOfficialRateWhereInput | CbarOfficialRateWhereInput[]
    rateDate?: DateTimeFilter<"CbarOfficialRate"> | Date | string
    currencyCode?: StringFilter<"CbarOfficialRate"> | string
    value?: DecimalFilter<"CbarOfficialRate"> | Decimal | DecimalJsLike | number | string
    nominal?: IntFilter<"CbarOfficialRate"> | number
    rate?: DecimalFilter<"CbarOfficialRate"> | Decimal | DecimalJsLike | number | string
    status?: EnumCbarRateStatusFilter<"CbarOfficialRate"> | $Enums.CbarRateStatus
    createdAt?: DateTimeFilter<"CbarOfficialRate"> | Date | string
    updatedAt?: DateTimeFilter<"CbarOfficialRate"> | Date | string
  }, "id" | "rateDate_currencyCode">

  export type CbarOfficialRateOrderByWithAggregationInput = {
    id?: SortOrder
    rateDate?: SortOrder
    currencyCode?: SortOrder
    value?: SortOrder
    nominal?: SortOrder
    rate?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CbarOfficialRateCountOrderByAggregateInput
    _avg?: CbarOfficialRateAvgOrderByAggregateInput
    _max?: CbarOfficialRateMaxOrderByAggregateInput
    _min?: CbarOfficialRateMinOrderByAggregateInput
    _sum?: CbarOfficialRateSumOrderByAggregateInput
  }

  export type CbarOfficialRateScalarWhereWithAggregatesInput = {
    AND?: CbarOfficialRateScalarWhereWithAggregatesInput | CbarOfficialRateScalarWhereWithAggregatesInput[]
    OR?: CbarOfficialRateScalarWhereWithAggregatesInput[]
    NOT?: CbarOfficialRateScalarWhereWithAggregatesInput | CbarOfficialRateScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"CbarOfficialRate"> | string
    rateDate?: DateTimeWithAggregatesFilter<"CbarOfficialRate"> | Date | string
    currencyCode?: StringWithAggregatesFilter<"CbarOfficialRate"> | string
    value?: DecimalWithAggregatesFilter<"CbarOfficialRate"> | Decimal | DecimalJsLike | number | string
    nominal?: IntWithAggregatesFilter<"CbarOfficialRate"> | number
    rate?: DecimalWithAggregatesFilter<"CbarOfficialRate"> | Decimal | DecimalJsLike | number | string
    status?: EnumCbarRateStatusWithAggregatesFilter<"CbarOfficialRate"> | $Enums.CbarRateStatus
    createdAt?: DateTimeWithAggregatesFilter<"CbarOfficialRate"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CbarOfficialRate"> | Date | string
  }

  export type GlobalCompanyDirectoryWhereInput = {
    AND?: GlobalCompanyDirectoryWhereInput | GlobalCompanyDirectoryWhereInput[]
    OR?: GlobalCompanyDirectoryWhereInput[]
    NOT?: GlobalCompanyDirectoryWhereInput | GlobalCompanyDirectoryWhereInput[]
    id?: UuidFilter<"GlobalCompanyDirectory"> | string
    taxId?: StringFilter<"GlobalCompanyDirectory"> | string
    name?: StringFilter<"GlobalCompanyDirectory"> | string
    legalForm?: EnumCounterpartyLegalFormNullableFilter<"GlobalCompanyDirectory"> | $Enums.CounterpartyLegalForm | null
    legalAddress?: StringNullableFilter<"GlobalCompanyDirectory"> | string | null
    phone?: StringNullableFilter<"GlobalCompanyDirectory"> | string | null
    directorName?: StringNullableFilter<"GlobalCompanyDirectory"> | string | null
    createdAt?: DateTimeFilter<"GlobalCompanyDirectory"> | Date | string
    updatedAt?: DateTimeFilter<"GlobalCompanyDirectory"> | Date | string
  }

  export type GlobalCompanyDirectoryOrderByWithRelationInput = {
    id?: SortOrder
    taxId?: SortOrder
    name?: SortOrder
    legalForm?: SortOrderInput | SortOrder
    legalAddress?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    directorName?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GlobalCompanyDirectoryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    taxId?: string
    AND?: GlobalCompanyDirectoryWhereInput | GlobalCompanyDirectoryWhereInput[]
    OR?: GlobalCompanyDirectoryWhereInput[]
    NOT?: GlobalCompanyDirectoryWhereInput | GlobalCompanyDirectoryWhereInput[]
    name?: StringFilter<"GlobalCompanyDirectory"> | string
    legalForm?: EnumCounterpartyLegalFormNullableFilter<"GlobalCompanyDirectory"> | $Enums.CounterpartyLegalForm | null
    legalAddress?: StringNullableFilter<"GlobalCompanyDirectory"> | string | null
    phone?: StringNullableFilter<"GlobalCompanyDirectory"> | string | null
    directorName?: StringNullableFilter<"GlobalCompanyDirectory"> | string | null
    createdAt?: DateTimeFilter<"GlobalCompanyDirectory"> | Date | string
    updatedAt?: DateTimeFilter<"GlobalCompanyDirectory"> | Date | string
  }, "id" | "taxId">

  export type GlobalCompanyDirectoryOrderByWithAggregationInput = {
    id?: SortOrder
    taxId?: SortOrder
    name?: SortOrder
    legalForm?: SortOrderInput | SortOrder
    legalAddress?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    directorName?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: GlobalCompanyDirectoryCountOrderByAggregateInput
    _max?: GlobalCompanyDirectoryMaxOrderByAggregateInput
    _min?: GlobalCompanyDirectoryMinOrderByAggregateInput
  }

  export type GlobalCompanyDirectoryScalarWhereWithAggregatesInput = {
    AND?: GlobalCompanyDirectoryScalarWhereWithAggregatesInput | GlobalCompanyDirectoryScalarWhereWithAggregatesInput[]
    OR?: GlobalCompanyDirectoryScalarWhereWithAggregatesInput[]
    NOT?: GlobalCompanyDirectoryScalarWhereWithAggregatesInput | GlobalCompanyDirectoryScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"GlobalCompanyDirectory"> | string
    taxId?: StringWithAggregatesFilter<"GlobalCompanyDirectory"> | string
    name?: StringWithAggregatesFilter<"GlobalCompanyDirectory"> | string
    legalForm?: EnumCounterpartyLegalFormNullableWithAggregatesFilter<"GlobalCompanyDirectory"> | $Enums.CounterpartyLegalForm | null
    legalAddress?: StringNullableWithAggregatesFilter<"GlobalCompanyDirectory"> | string | null
    phone?: StringNullableWithAggregatesFilter<"GlobalCompanyDirectory"> | string | null
    directorName?: StringNullableWithAggregatesFilter<"GlobalCompanyDirectory"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"GlobalCompanyDirectory"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"GlobalCompanyDirectory"> | Date | string
  }

  export type BankGlossaryWhereInput = {
    AND?: BankGlossaryWhereInput | BankGlossaryWhereInput[]
    OR?: BankGlossaryWhereInput[]
    NOT?: BankGlossaryWhereInput | BankGlossaryWhereInput[]
    id?: UuidFilter<"BankGlossary"> | string
    nameAz?: StringFilter<"BankGlossary"> | string
    voen?: StringFilter<"BankGlossary"> | string
    code?: StringFilter<"BankGlossary"> | string
    correspondentIban?: StringNullableFilter<"BankGlossary"> | string | null
    swift?: StringNullableFilter<"BankGlossary"> | string | null
    headPhones?: StringNullableListFilter<"BankGlossary">
    headAddress?: StringNullableFilter<"BankGlossary"> | string | null
    isActive?: BoolFilter<"BankGlossary"> | boolean
    createdAt?: DateTimeFilter<"BankGlossary"> | Date | string
    updatedAt?: DateTimeFilter<"BankGlossary"> | Date | string
    branches?: BankBranchListRelationFilter
  }

  export type BankGlossaryOrderByWithRelationInput = {
    id?: SortOrder
    nameAz?: SortOrder
    voen?: SortOrder
    code?: SortOrder
    correspondentIban?: SortOrderInput | SortOrder
    swift?: SortOrderInput | SortOrder
    headPhones?: SortOrder
    headAddress?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    branches?: BankBranchOrderByRelationAggregateInput
  }

  export type BankGlossaryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    voen?: string
    code?: string
    correspondentIban?: string
    AND?: BankGlossaryWhereInput | BankGlossaryWhereInput[]
    OR?: BankGlossaryWhereInput[]
    NOT?: BankGlossaryWhereInput | BankGlossaryWhereInput[]
    nameAz?: StringFilter<"BankGlossary"> | string
    swift?: StringNullableFilter<"BankGlossary"> | string | null
    headPhones?: StringNullableListFilter<"BankGlossary">
    headAddress?: StringNullableFilter<"BankGlossary"> | string | null
    isActive?: BoolFilter<"BankGlossary"> | boolean
    createdAt?: DateTimeFilter<"BankGlossary"> | Date | string
    updatedAt?: DateTimeFilter<"BankGlossary"> | Date | string
    branches?: BankBranchListRelationFilter
  }, "id" | "voen" | "code" | "correspondentIban">

  export type BankGlossaryOrderByWithAggregationInput = {
    id?: SortOrder
    nameAz?: SortOrder
    voen?: SortOrder
    code?: SortOrder
    correspondentIban?: SortOrderInput | SortOrder
    swift?: SortOrderInput | SortOrder
    headPhones?: SortOrder
    headAddress?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: BankGlossaryCountOrderByAggregateInput
    _max?: BankGlossaryMaxOrderByAggregateInput
    _min?: BankGlossaryMinOrderByAggregateInput
  }

  export type BankGlossaryScalarWhereWithAggregatesInput = {
    AND?: BankGlossaryScalarWhereWithAggregatesInput | BankGlossaryScalarWhereWithAggregatesInput[]
    OR?: BankGlossaryScalarWhereWithAggregatesInput[]
    NOT?: BankGlossaryScalarWhereWithAggregatesInput | BankGlossaryScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"BankGlossary"> | string
    nameAz?: StringWithAggregatesFilter<"BankGlossary"> | string
    voen?: StringWithAggregatesFilter<"BankGlossary"> | string
    code?: StringWithAggregatesFilter<"BankGlossary"> | string
    correspondentIban?: StringNullableWithAggregatesFilter<"BankGlossary"> | string | null
    swift?: StringNullableWithAggregatesFilter<"BankGlossary"> | string | null
    headPhones?: StringNullableListFilter<"BankGlossary">
    headAddress?: StringNullableWithAggregatesFilter<"BankGlossary"> | string | null
    isActive?: BoolWithAggregatesFilter<"BankGlossary"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"BankGlossary"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"BankGlossary"> | Date | string
  }

  export type BankBranchWhereInput = {
    AND?: BankBranchWhereInput | BankBranchWhereInput[]
    OR?: BankBranchWhereInput[]
    NOT?: BankBranchWhereInput | BankBranchWhereInput[]
    id?: UuidFilter<"BankBranch"> | string
    bankId?: UuidFilter<"BankBranch"> | string
    branchCode?: StringFilter<"BankBranch"> | string
    name?: StringFilter<"BankBranch"> | string
    swift?: StringNullableFilter<"BankBranch"> | string | null
    address?: StringNullableFilter<"BankBranch"> | string | null
    phones?: StringNullableListFilter<"BankBranch">
    isHeadOffice?: BoolFilter<"BankBranch"> | boolean
    isActive?: BoolFilter<"BankBranch"> | boolean
    createdAt?: DateTimeFilter<"BankBranch"> | Date | string
    updatedAt?: DateTimeFilter<"BankBranch"> | Date | string
    bank?: XOR<BankGlossaryScalarRelationFilter, BankGlossaryWhereInput>
  }

  export type BankBranchOrderByWithRelationInput = {
    id?: SortOrder
    bankId?: SortOrder
    branchCode?: SortOrder
    name?: SortOrder
    swift?: SortOrderInput | SortOrder
    address?: SortOrderInput | SortOrder
    phones?: SortOrder
    isHeadOffice?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    bank?: BankGlossaryOrderByWithRelationInput
  }

  export type BankBranchWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    bankId_branchCode?: BankBranchBankIdBranchCodeCompoundUniqueInput
    AND?: BankBranchWhereInput | BankBranchWhereInput[]
    OR?: BankBranchWhereInput[]
    NOT?: BankBranchWhereInput | BankBranchWhereInput[]
    bankId?: UuidFilter<"BankBranch"> | string
    branchCode?: StringFilter<"BankBranch"> | string
    name?: StringFilter<"BankBranch"> | string
    swift?: StringNullableFilter<"BankBranch"> | string | null
    address?: StringNullableFilter<"BankBranch"> | string | null
    phones?: StringNullableListFilter<"BankBranch">
    isHeadOffice?: BoolFilter<"BankBranch"> | boolean
    isActive?: BoolFilter<"BankBranch"> | boolean
    createdAt?: DateTimeFilter<"BankBranch"> | Date | string
    updatedAt?: DateTimeFilter<"BankBranch"> | Date | string
    bank?: XOR<BankGlossaryScalarRelationFilter, BankGlossaryWhereInput>
  }, "id" | "bankId_branchCode">

  export type BankBranchOrderByWithAggregationInput = {
    id?: SortOrder
    bankId?: SortOrder
    branchCode?: SortOrder
    name?: SortOrder
    swift?: SortOrderInput | SortOrder
    address?: SortOrderInput | SortOrder
    phones?: SortOrder
    isHeadOffice?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: BankBranchCountOrderByAggregateInput
    _max?: BankBranchMaxOrderByAggregateInput
    _min?: BankBranchMinOrderByAggregateInput
  }

  export type BankBranchScalarWhereWithAggregatesInput = {
    AND?: BankBranchScalarWhereWithAggregatesInput | BankBranchScalarWhereWithAggregatesInput[]
    OR?: BankBranchScalarWhereWithAggregatesInput[]
    NOT?: BankBranchScalarWhereWithAggregatesInput | BankBranchScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"BankBranch"> | string
    bankId?: UuidWithAggregatesFilter<"BankBranch"> | string
    branchCode?: StringWithAggregatesFilter<"BankBranch"> | string
    name?: StringWithAggregatesFilter<"BankBranch"> | string
    swift?: StringNullableWithAggregatesFilter<"BankBranch"> | string | null
    address?: StringNullableWithAggregatesFilter<"BankBranch"> | string | null
    phones?: StringNullableListFilter<"BankBranch">
    isHeadOffice?: BoolWithAggregatesFilter<"BankBranch"> | boolean
    isActive?: BoolWithAggregatesFilter<"BankBranch"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"BankBranch"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"BankBranch"> | Date | string
  }

  export type CustomsTariffRateWhereInput = {
    AND?: CustomsTariffRateWhereInput | CustomsTariffRateWhereInput[]
    OR?: CustomsTariffRateWhereInput[]
    NOT?: CustomsTariffRateWhereInput | CustomsTariffRateWhereInput[]
    id?: UuidFilter<"CustomsTariffRate"> | string
    hsCode?: StringFilter<"CustomsTariffRate"> | string
    description?: StringNullableFilter<"CustomsTariffRate"> | string | null
    dutyRatePercent?: DecimalFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    vatRatePercent?: DecimalFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    excisePercent?: DecimalFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFilter<"CustomsTariffRate"> | Date | string
    effectiveTo?: DateTimeNullableFilter<"CustomsTariffRate"> | Date | string | null
    notes?: StringNullableFilter<"CustomsTariffRate"> | string | null
    deletedAt?: DateTimeNullableFilter<"CustomsTariffRate"> | Date | string | null
    createdAt?: DateTimeFilter<"CustomsTariffRate"> | Date | string
    updatedAt?: DateTimeFilter<"CustomsTariffRate"> | Date | string
  }

  export type CustomsTariffRateOrderByWithRelationInput = {
    id?: SortOrder
    hsCode?: SortOrder
    description?: SortOrderInput | SortOrder
    dutyRatePercent?: SortOrder
    vatRatePercent?: SortOrder
    excisePercent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    deletedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CustomsTariffRateWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    hsCode_effectiveFrom?: CustomsTariffRateHsCodeEffectiveFromCompoundUniqueInput
    AND?: CustomsTariffRateWhereInput | CustomsTariffRateWhereInput[]
    OR?: CustomsTariffRateWhereInput[]
    NOT?: CustomsTariffRateWhereInput | CustomsTariffRateWhereInput[]
    hsCode?: StringFilter<"CustomsTariffRate"> | string
    description?: StringNullableFilter<"CustomsTariffRate"> | string | null
    dutyRatePercent?: DecimalFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    vatRatePercent?: DecimalFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    excisePercent?: DecimalFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFilter<"CustomsTariffRate"> | Date | string
    effectiveTo?: DateTimeNullableFilter<"CustomsTariffRate"> | Date | string | null
    notes?: StringNullableFilter<"CustomsTariffRate"> | string | null
    deletedAt?: DateTimeNullableFilter<"CustomsTariffRate"> | Date | string | null
    createdAt?: DateTimeFilter<"CustomsTariffRate"> | Date | string
    updatedAt?: DateTimeFilter<"CustomsTariffRate"> | Date | string
  }, "id" | "hsCode_effectiveFrom">

  export type CustomsTariffRateOrderByWithAggregationInput = {
    id?: SortOrder
    hsCode?: SortOrder
    description?: SortOrderInput | SortOrder
    dutyRatePercent?: SortOrder
    vatRatePercent?: SortOrder
    excisePercent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    deletedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CustomsTariffRateCountOrderByAggregateInput
    _avg?: CustomsTariffRateAvgOrderByAggregateInput
    _max?: CustomsTariffRateMaxOrderByAggregateInput
    _min?: CustomsTariffRateMinOrderByAggregateInput
    _sum?: CustomsTariffRateSumOrderByAggregateInput
  }

  export type CustomsTariffRateScalarWhereWithAggregatesInput = {
    AND?: CustomsTariffRateScalarWhereWithAggregatesInput | CustomsTariffRateScalarWhereWithAggregatesInput[]
    OR?: CustomsTariffRateScalarWhereWithAggregatesInput[]
    NOT?: CustomsTariffRateScalarWhereWithAggregatesInput | CustomsTariffRateScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"CustomsTariffRate"> | string
    hsCode?: StringWithAggregatesFilter<"CustomsTariffRate"> | string
    description?: StringNullableWithAggregatesFilter<"CustomsTariffRate"> | string | null
    dutyRatePercent?: DecimalWithAggregatesFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    vatRatePercent?: DecimalWithAggregatesFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    excisePercent?: DecimalWithAggregatesFilter<"CustomsTariffRate"> | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeWithAggregatesFilter<"CustomsTariffRate"> | Date | string
    effectiveTo?: DateTimeNullableWithAggregatesFilter<"CustomsTariffRate"> | Date | string | null
    notes?: StringNullableWithAggregatesFilter<"CustomsTariffRate"> | string | null
    deletedAt?: DateTimeNullableWithAggregatesFilter<"CustomsTariffRate"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"CustomsTariffRate"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CustomsTariffRate"> | Date | string
  }

  export type UnitOfMeasureWhereInput = {
    AND?: UnitOfMeasureWhereInput | UnitOfMeasureWhereInput[]
    OR?: UnitOfMeasureWhereInput[]
    NOT?: UnitOfMeasureWhereInput | UnitOfMeasureWhereInput[]
    id?: UuidFilter<"UnitOfMeasure"> | string
    code?: StringFilter<"UnitOfMeasure"> | string
    kind?: EnumUnitOfMeasureKindFilter<"UnitOfMeasure"> | $Enums.UnitOfMeasureKind
    baseCode?: StringNullableFilter<"UnitOfMeasure"> | string | null
    factor?: DecimalFilter<"UnitOfMeasure"> | Decimal | DecimalJsLike | number | string
    nameAz?: StringFilter<"UnitOfMeasure"> | string
    nameRu?: StringFilter<"UnitOfMeasure"> | string
    nameEn?: StringFilter<"UnitOfMeasure"> | string
    isActive?: BoolFilter<"UnitOfMeasure"> | boolean
    sortOrder?: IntFilter<"UnitOfMeasure"> | number
    createdAt?: DateTimeFilter<"UnitOfMeasure"> | Date | string
    updatedAt?: DateTimeFilter<"UnitOfMeasure"> | Date | string
  }

  export type UnitOfMeasureOrderByWithRelationInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    baseCode?: SortOrderInput | SortOrder
    factor?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UnitOfMeasureWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    code?: string
    AND?: UnitOfMeasureWhereInput | UnitOfMeasureWhereInput[]
    OR?: UnitOfMeasureWhereInput[]
    NOT?: UnitOfMeasureWhereInput | UnitOfMeasureWhereInput[]
    kind?: EnumUnitOfMeasureKindFilter<"UnitOfMeasure"> | $Enums.UnitOfMeasureKind
    baseCode?: StringNullableFilter<"UnitOfMeasure"> | string | null
    factor?: DecimalFilter<"UnitOfMeasure"> | Decimal | DecimalJsLike | number | string
    nameAz?: StringFilter<"UnitOfMeasure"> | string
    nameRu?: StringFilter<"UnitOfMeasure"> | string
    nameEn?: StringFilter<"UnitOfMeasure"> | string
    isActive?: BoolFilter<"UnitOfMeasure"> | boolean
    sortOrder?: IntFilter<"UnitOfMeasure"> | number
    createdAt?: DateTimeFilter<"UnitOfMeasure"> | Date | string
    updatedAt?: DateTimeFilter<"UnitOfMeasure"> | Date | string
  }, "id" | "code">

  export type UnitOfMeasureOrderByWithAggregationInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    baseCode?: SortOrderInput | SortOrder
    factor?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UnitOfMeasureCountOrderByAggregateInput
    _avg?: UnitOfMeasureAvgOrderByAggregateInput
    _max?: UnitOfMeasureMaxOrderByAggregateInput
    _min?: UnitOfMeasureMinOrderByAggregateInput
    _sum?: UnitOfMeasureSumOrderByAggregateInput
  }

  export type UnitOfMeasureScalarWhereWithAggregatesInput = {
    AND?: UnitOfMeasureScalarWhereWithAggregatesInput | UnitOfMeasureScalarWhereWithAggregatesInput[]
    OR?: UnitOfMeasureScalarWhereWithAggregatesInput[]
    NOT?: UnitOfMeasureScalarWhereWithAggregatesInput | UnitOfMeasureScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"UnitOfMeasure"> | string
    code?: StringWithAggregatesFilter<"UnitOfMeasure"> | string
    kind?: EnumUnitOfMeasureKindWithAggregatesFilter<"UnitOfMeasure"> | $Enums.UnitOfMeasureKind
    baseCode?: StringNullableWithAggregatesFilter<"UnitOfMeasure"> | string | null
    factor?: DecimalWithAggregatesFilter<"UnitOfMeasure"> | Decimal | DecimalJsLike | number | string
    nameAz?: StringWithAggregatesFilter<"UnitOfMeasure"> | string
    nameRu?: StringWithAggregatesFilter<"UnitOfMeasure"> | string
    nameEn?: StringWithAggregatesFilter<"UnitOfMeasure"> | string
    isActive?: BoolWithAggregatesFilter<"UnitOfMeasure"> | boolean
    sortOrder?: IntWithAggregatesFilter<"UnitOfMeasure"> | number
    createdAt?: DateTimeWithAggregatesFilter<"UnitOfMeasure"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"UnitOfMeasure"> | Date | string
  }

  export type CurrencyWhereInput = {
    AND?: CurrencyWhereInput | CurrencyWhereInput[]
    OR?: CurrencyWhereInput[]
    NOT?: CurrencyWhereInput | CurrencyWhereInput[]
    id?: UuidFilter<"Currency"> | string
    code?: StringFilter<"Currency"> | string
    symbol?: StringFilter<"Currency"> | string
    decimals?: IntFilter<"Currency"> | number
    nameAz?: StringFilter<"Currency"> | string
    nameRu?: StringFilter<"Currency"> | string
    nameEn?: StringFilter<"Currency"> | string
    isActive?: BoolFilter<"Currency"> | boolean
    sortOrder?: IntFilter<"Currency"> | number
    createdAt?: DateTimeFilter<"Currency"> | Date | string
    updatedAt?: DateTimeFilter<"Currency"> | Date | string
  }

  export type CurrencyOrderByWithRelationInput = {
    id?: SortOrder
    code?: SortOrder
    symbol?: SortOrder
    decimals?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CurrencyWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    code?: string
    AND?: CurrencyWhereInput | CurrencyWhereInput[]
    OR?: CurrencyWhereInput[]
    NOT?: CurrencyWhereInput | CurrencyWhereInput[]
    symbol?: StringFilter<"Currency"> | string
    decimals?: IntFilter<"Currency"> | number
    nameAz?: StringFilter<"Currency"> | string
    nameRu?: StringFilter<"Currency"> | string
    nameEn?: StringFilter<"Currency"> | string
    isActive?: BoolFilter<"Currency"> | boolean
    sortOrder?: IntFilter<"Currency"> | number
    createdAt?: DateTimeFilter<"Currency"> | Date | string
    updatedAt?: DateTimeFilter<"Currency"> | Date | string
  }, "id" | "code">

  export type CurrencyOrderByWithAggregationInput = {
    id?: SortOrder
    code?: SortOrder
    symbol?: SortOrder
    decimals?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CurrencyCountOrderByAggregateInput
    _avg?: CurrencyAvgOrderByAggregateInput
    _max?: CurrencyMaxOrderByAggregateInput
    _min?: CurrencyMinOrderByAggregateInput
    _sum?: CurrencySumOrderByAggregateInput
  }

  export type CurrencyScalarWhereWithAggregatesInput = {
    AND?: CurrencyScalarWhereWithAggregatesInput | CurrencyScalarWhereWithAggregatesInput[]
    OR?: CurrencyScalarWhereWithAggregatesInput[]
    NOT?: CurrencyScalarWhereWithAggregatesInput | CurrencyScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"Currency"> | string
    code?: StringWithAggregatesFilter<"Currency"> | string
    symbol?: StringWithAggregatesFilter<"Currency"> | string
    decimals?: IntWithAggregatesFilter<"Currency"> | number
    nameAz?: StringWithAggregatesFilter<"Currency"> | string
    nameRu?: StringWithAggregatesFilter<"Currency"> | string
    nameEn?: StringWithAggregatesFilter<"Currency"> | string
    isActive?: BoolWithAggregatesFilter<"Currency"> | boolean
    sortOrder?: IntWithAggregatesFilter<"Currency"> | number
    createdAt?: DateTimeWithAggregatesFilter<"Currency"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Currency"> | Date | string
  }

  export type CountryWhereInput = {
    AND?: CountryWhereInput | CountryWhereInput[]
    OR?: CountryWhereInput[]
    NOT?: CountryWhereInput | CountryWhereInput[]
    id?: UuidFilter<"Country"> | string
    iso2?: StringFilter<"Country"> | string
    iso3?: StringNullableFilter<"Country"> | string | null
    dialingCode?: StringNullableFilter<"Country"> | string | null
    currencyCode?: StringNullableFilter<"Country"> | string | null
    nameAz?: StringFilter<"Country"> | string
    nameRu?: StringFilter<"Country"> | string
    nameEn?: StringFilter<"Country"> | string
    sortOrder?: IntFilter<"Country"> | number
    createdAt?: DateTimeFilter<"Country"> | Date | string
    updatedAt?: DateTimeFilter<"Country"> | Date | string
    cities?: CityListRelationFilter
  }

  export type CountryOrderByWithRelationInput = {
    id?: SortOrder
    iso2?: SortOrder
    iso3?: SortOrderInput | SortOrder
    dialingCode?: SortOrderInput | SortOrder
    currencyCode?: SortOrderInput | SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    cities?: CityOrderByRelationAggregateInput
  }

  export type CountryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    iso2?: string
    AND?: CountryWhereInput | CountryWhereInput[]
    OR?: CountryWhereInput[]
    NOT?: CountryWhereInput | CountryWhereInput[]
    iso3?: StringNullableFilter<"Country"> | string | null
    dialingCode?: StringNullableFilter<"Country"> | string | null
    currencyCode?: StringNullableFilter<"Country"> | string | null
    nameAz?: StringFilter<"Country"> | string
    nameRu?: StringFilter<"Country"> | string
    nameEn?: StringFilter<"Country"> | string
    sortOrder?: IntFilter<"Country"> | number
    createdAt?: DateTimeFilter<"Country"> | Date | string
    updatedAt?: DateTimeFilter<"Country"> | Date | string
    cities?: CityListRelationFilter
  }, "id" | "iso2">

  export type CountryOrderByWithAggregationInput = {
    id?: SortOrder
    iso2?: SortOrder
    iso3?: SortOrderInput | SortOrder
    dialingCode?: SortOrderInput | SortOrder
    currencyCode?: SortOrderInput | SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CountryCountOrderByAggregateInput
    _avg?: CountryAvgOrderByAggregateInput
    _max?: CountryMaxOrderByAggregateInput
    _min?: CountryMinOrderByAggregateInput
    _sum?: CountrySumOrderByAggregateInput
  }

  export type CountryScalarWhereWithAggregatesInput = {
    AND?: CountryScalarWhereWithAggregatesInput | CountryScalarWhereWithAggregatesInput[]
    OR?: CountryScalarWhereWithAggregatesInput[]
    NOT?: CountryScalarWhereWithAggregatesInput | CountryScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"Country"> | string
    iso2?: StringWithAggregatesFilter<"Country"> | string
    iso3?: StringNullableWithAggregatesFilter<"Country"> | string | null
    dialingCode?: StringNullableWithAggregatesFilter<"Country"> | string | null
    currencyCode?: StringNullableWithAggregatesFilter<"Country"> | string | null
    nameAz?: StringWithAggregatesFilter<"Country"> | string
    nameRu?: StringWithAggregatesFilter<"Country"> | string
    nameEn?: StringWithAggregatesFilter<"Country"> | string
    sortOrder?: IntWithAggregatesFilter<"Country"> | number
    createdAt?: DateTimeWithAggregatesFilter<"Country"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Country"> | Date | string
  }

  export type CityWhereInput = {
    AND?: CityWhereInput | CityWhereInput[]
    OR?: CityWhereInput[]
    NOT?: CityWhereInput | CityWhereInput[]
    id?: UuidFilter<"City"> | string
    code?: StringFilter<"City"> | string
    countryIso2?: StringFilter<"City"> | string
    region?: StringNullableFilter<"City"> | string | null
    isCapital?: BoolFilter<"City"> | boolean
    nameAz?: StringFilter<"City"> | string
    nameRu?: StringFilter<"City"> | string
    nameEn?: StringFilter<"City"> | string
    sortOrder?: IntFilter<"City"> | number
    createdAt?: DateTimeFilter<"City"> | Date | string
    updatedAt?: DateTimeFilter<"City"> | Date | string
    country?: XOR<CountryScalarRelationFilter, CountryWhereInput>
  }

  export type CityOrderByWithRelationInput = {
    id?: SortOrder
    code?: SortOrder
    countryIso2?: SortOrder
    region?: SortOrderInput | SortOrder
    isCapital?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    country?: CountryOrderByWithRelationInput
  }

  export type CityWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    code?: string
    AND?: CityWhereInput | CityWhereInput[]
    OR?: CityWhereInput[]
    NOT?: CityWhereInput | CityWhereInput[]
    countryIso2?: StringFilter<"City"> | string
    region?: StringNullableFilter<"City"> | string | null
    isCapital?: BoolFilter<"City"> | boolean
    nameAz?: StringFilter<"City"> | string
    nameRu?: StringFilter<"City"> | string
    nameEn?: StringFilter<"City"> | string
    sortOrder?: IntFilter<"City"> | number
    createdAt?: DateTimeFilter<"City"> | Date | string
    updatedAt?: DateTimeFilter<"City"> | Date | string
    country?: XOR<CountryScalarRelationFilter, CountryWhereInput>
  }, "id" | "code">

  export type CityOrderByWithAggregationInput = {
    id?: SortOrder
    code?: SortOrder
    countryIso2?: SortOrder
    region?: SortOrderInput | SortOrder
    isCapital?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CityCountOrderByAggregateInput
    _avg?: CityAvgOrderByAggregateInput
    _max?: CityMaxOrderByAggregateInput
    _min?: CityMinOrderByAggregateInput
    _sum?: CitySumOrderByAggregateInput
  }

  export type CityScalarWhereWithAggregatesInput = {
    AND?: CityScalarWhereWithAggregatesInput | CityScalarWhereWithAggregatesInput[]
    OR?: CityScalarWhereWithAggregatesInput[]
    NOT?: CityScalarWhereWithAggregatesInput | CityScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"City"> | string
    code?: StringWithAggregatesFilter<"City"> | string
    countryIso2?: StringWithAggregatesFilter<"City"> | string
    region?: StringNullableWithAggregatesFilter<"City"> | string | null
    isCapital?: BoolWithAggregatesFilter<"City"> | boolean
    nameAz?: StringWithAggregatesFilter<"City"> | string
    nameRu?: StringWithAggregatesFilter<"City"> | string
    nameEn?: StringWithAggregatesFilter<"City"> | string
    sortOrder?: IntWithAggregatesFilter<"City"> | number
    createdAt?: DateTimeWithAggregatesFilter<"City"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"City"> | Date | string
  }

  export type TaxRateWhereInput = {
    AND?: TaxRateWhereInput | TaxRateWhereInput[]
    OR?: TaxRateWhereInput[]
    NOT?: TaxRateWhereInput | TaxRateWhereInput[]
    id?: UuidFilter<"TaxRate"> | string
    code?: StringFilter<"TaxRate"> | string
    kind?: EnumTaxRateKindFilter<"TaxRate"> | $Enums.TaxRateKind
    region?: StringFilter<"TaxRate"> | string
    percent?: DecimalFilter<"TaxRate"> | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFilter<"TaxRate"> | Date | string
    effectiveTo?: DateTimeNullableFilter<"TaxRate"> | Date | string | null
    nameAz?: StringFilter<"TaxRate"> | string
    nameRu?: StringFilter<"TaxRate"> | string
    nameEn?: StringFilter<"TaxRate"> | string
    sortOrder?: IntFilter<"TaxRate"> | number
    isActive?: BoolFilter<"TaxRate"> | boolean
    createdAt?: DateTimeFilter<"TaxRate"> | Date | string
    updatedAt?: DateTimeFilter<"TaxRate"> | Date | string
  }

  export type TaxRateOrderByWithRelationInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    region?: SortOrder
    percent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrderInput | SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TaxRateWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    code?: string
    AND?: TaxRateWhereInput | TaxRateWhereInput[]
    OR?: TaxRateWhereInput[]
    NOT?: TaxRateWhereInput | TaxRateWhereInput[]
    kind?: EnumTaxRateKindFilter<"TaxRate"> | $Enums.TaxRateKind
    region?: StringFilter<"TaxRate"> | string
    percent?: DecimalFilter<"TaxRate"> | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFilter<"TaxRate"> | Date | string
    effectiveTo?: DateTimeNullableFilter<"TaxRate"> | Date | string | null
    nameAz?: StringFilter<"TaxRate"> | string
    nameRu?: StringFilter<"TaxRate"> | string
    nameEn?: StringFilter<"TaxRate"> | string
    sortOrder?: IntFilter<"TaxRate"> | number
    isActive?: BoolFilter<"TaxRate"> | boolean
    createdAt?: DateTimeFilter<"TaxRate"> | Date | string
    updatedAt?: DateTimeFilter<"TaxRate"> | Date | string
  }, "id" | "code">

  export type TaxRateOrderByWithAggregationInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    region?: SortOrder
    percent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrderInput | SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TaxRateCountOrderByAggregateInput
    _avg?: TaxRateAvgOrderByAggregateInput
    _max?: TaxRateMaxOrderByAggregateInput
    _min?: TaxRateMinOrderByAggregateInput
    _sum?: TaxRateSumOrderByAggregateInput
  }

  export type TaxRateScalarWhereWithAggregatesInput = {
    AND?: TaxRateScalarWhereWithAggregatesInput | TaxRateScalarWhereWithAggregatesInput[]
    OR?: TaxRateScalarWhereWithAggregatesInput[]
    NOT?: TaxRateScalarWhereWithAggregatesInput | TaxRateScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"TaxRate"> | string
    code?: StringWithAggregatesFilter<"TaxRate"> | string
    kind?: EnumTaxRateKindWithAggregatesFilter<"TaxRate"> | $Enums.TaxRateKind
    region?: StringWithAggregatesFilter<"TaxRate"> | string
    percent?: DecimalWithAggregatesFilter<"TaxRate"> | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeWithAggregatesFilter<"TaxRate"> | Date | string
    effectiveTo?: DateTimeNullableWithAggregatesFilter<"TaxRate"> | Date | string | null
    nameAz?: StringWithAggregatesFilter<"TaxRate"> | string
    nameRu?: StringWithAggregatesFilter<"TaxRate"> | string
    nameEn?: StringWithAggregatesFilter<"TaxRate"> | string
    sortOrder?: IntWithAggregatesFilter<"TaxRate"> | number
    isActive?: BoolWithAggregatesFilter<"TaxRate"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"TaxRate"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TaxRate"> | Date | string
  }

  export type CalendarDayCreateInput = {
    id?: string
    country?: string
    date: Date | string
    isWorking: boolean
    dayType: string
    labelAz?: string | null
    labelRu?: string | null
    labelEn?: string | null
    source?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CalendarDayUncheckedCreateInput = {
    id?: string
    country?: string
    date: Date | string
    isWorking: boolean
    dayType: string
    labelAz?: string | null
    labelRu?: string | null
    labelEn?: string | null
    source?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CalendarDayUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    isWorking?: BoolFieldUpdateOperationsInput | boolean
    dayType?: StringFieldUpdateOperationsInput | string
    labelAz?: NullableStringFieldUpdateOperationsInput | string | null
    labelRu?: NullableStringFieldUpdateOperationsInput | string | null
    labelEn?: NullableStringFieldUpdateOperationsInput | string | null
    source?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarDayUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    isWorking?: BoolFieldUpdateOperationsInput | boolean
    dayType?: StringFieldUpdateOperationsInput | string
    labelAz?: NullableStringFieldUpdateOperationsInput | string | null
    labelRu?: NullableStringFieldUpdateOperationsInput | string | null
    labelEn?: NullableStringFieldUpdateOperationsInput | string | null
    source?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarDayCreateManyInput = {
    id?: string
    country?: string
    date: Date | string
    isWorking: boolean
    dayType: string
    labelAz?: string | null
    labelRu?: string | null
    labelEn?: string | null
    source?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CalendarDayUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    isWorking?: BoolFieldUpdateOperationsInput | boolean
    dayType?: StringFieldUpdateOperationsInput | string
    labelAz?: NullableStringFieldUpdateOperationsInput | string | null
    labelRu?: NullableStringFieldUpdateOperationsInput | string | null
    labelEn?: NullableStringFieldUpdateOperationsInput | string | null
    source?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarDayUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    isWorking?: BoolFieldUpdateOperationsInput | boolean
    dayType?: StringFieldUpdateOperationsInput | string
    labelAz?: NullableStringFieldUpdateOperationsInput | string | null
    labelRu?: NullableStringFieldUpdateOperationsInput | string | null
    labelEn?: NullableStringFieldUpdateOperationsInput | string | null
    source?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CbarOfficialRateCreateInput = {
    id?: string
    rateDate: Date | string
    currencyCode: string
    value: Decimal | DecimalJsLike | number | string
    nominal: number
    rate: Decimal | DecimalJsLike | number | string
    status?: $Enums.CbarRateStatus
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CbarOfficialRateUncheckedCreateInput = {
    id?: string
    rateDate: Date | string
    currencyCode: string
    value: Decimal | DecimalJsLike | number | string
    nominal: number
    rate: Decimal | DecimalJsLike | number | string
    status?: $Enums.CbarRateStatus
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CbarOfficialRateUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    rateDate?: DateTimeFieldUpdateOperationsInput | Date | string
    currencyCode?: StringFieldUpdateOperationsInput | string
    value?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    nominal?: IntFieldUpdateOperationsInput | number
    rate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    status?: EnumCbarRateStatusFieldUpdateOperationsInput | $Enums.CbarRateStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CbarOfficialRateUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    rateDate?: DateTimeFieldUpdateOperationsInput | Date | string
    currencyCode?: StringFieldUpdateOperationsInput | string
    value?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    nominal?: IntFieldUpdateOperationsInput | number
    rate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    status?: EnumCbarRateStatusFieldUpdateOperationsInput | $Enums.CbarRateStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CbarOfficialRateCreateManyInput = {
    id?: string
    rateDate: Date | string
    currencyCode: string
    value: Decimal | DecimalJsLike | number | string
    nominal: number
    rate: Decimal | DecimalJsLike | number | string
    status?: $Enums.CbarRateStatus
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CbarOfficialRateUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    rateDate?: DateTimeFieldUpdateOperationsInput | Date | string
    currencyCode?: StringFieldUpdateOperationsInput | string
    value?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    nominal?: IntFieldUpdateOperationsInput | number
    rate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    status?: EnumCbarRateStatusFieldUpdateOperationsInput | $Enums.CbarRateStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CbarOfficialRateUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    rateDate?: DateTimeFieldUpdateOperationsInput | Date | string
    currencyCode?: StringFieldUpdateOperationsInput | string
    value?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    nominal?: IntFieldUpdateOperationsInput | number
    rate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    status?: EnumCbarRateStatusFieldUpdateOperationsInput | $Enums.CbarRateStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalCompanyDirectoryCreateInput = {
    id?: string
    taxId: string
    name: string
    legalForm?: $Enums.CounterpartyLegalForm | null
    legalAddress?: string | null
    phone?: string | null
    directorName?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GlobalCompanyDirectoryUncheckedCreateInput = {
    id?: string
    taxId: string
    name: string
    legalForm?: $Enums.CounterpartyLegalForm | null
    legalAddress?: string | null
    phone?: string | null
    directorName?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GlobalCompanyDirectoryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    taxId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    legalForm?: NullableEnumCounterpartyLegalFormFieldUpdateOperationsInput | $Enums.CounterpartyLegalForm | null
    legalAddress?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    directorName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalCompanyDirectoryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    taxId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    legalForm?: NullableEnumCounterpartyLegalFormFieldUpdateOperationsInput | $Enums.CounterpartyLegalForm | null
    legalAddress?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    directorName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalCompanyDirectoryCreateManyInput = {
    id?: string
    taxId: string
    name: string
    legalForm?: $Enums.CounterpartyLegalForm | null
    legalAddress?: string | null
    phone?: string | null
    directorName?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GlobalCompanyDirectoryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    taxId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    legalForm?: NullableEnumCounterpartyLegalFormFieldUpdateOperationsInput | $Enums.CounterpartyLegalForm | null
    legalAddress?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    directorName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalCompanyDirectoryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    taxId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    legalForm?: NullableEnumCounterpartyLegalFormFieldUpdateOperationsInput | $Enums.CounterpartyLegalForm | null
    legalAddress?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    directorName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankGlossaryCreateInput = {
    id?: string
    nameAz: string
    voen: string
    code: string
    correspondentIban?: string | null
    swift?: string | null
    headPhones?: BankGlossaryCreateheadPhonesInput | string[]
    headAddress?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    branches?: BankBranchCreateNestedManyWithoutBankInput
  }

  export type BankGlossaryUncheckedCreateInput = {
    id?: string
    nameAz: string
    voen: string
    code: string
    correspondentIban?: string | null
    swift?: string | null
    headPhones?: BankGlossaryCreateheadPhonesInput | string[]
    headAddress?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    branches?: BankBranchUncheckedCreateNestedManyWithoutBankInput
  }

  export type BankGlossaryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nameAz?: StringFieldUpdateOperationsInput | string
    voen?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    correspondentIban?: NullableStringFieldUpdateOperationsInput | string | null
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    headPhones?: BankGlossaryUpdateheadPhonesInput | string[]
    headAddress?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    branches?: BankBranchUpdateManyWithoutBankNestedInput
  }

  export type BankGlossaryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nameAz?: StringFieldUpdateOperationsInput | string
    voen?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    correspondentIban?: NullableStringFieldUpdateOperationsInput | string | null
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    headPhones?: BankGlossaryUpdateheadPhonesInput | string[]
    headAddress?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    branches?: BankBranchUncheckedUpdateManyWithoutBankNestedInput
  }

  export type BankGlossaryCreateManyInput = {
    id?: string
    nameAz: string
    voen: string
    code: string
    correspondentIban?: string | null
    swift?: string | null
    headPhones?: BankGlossaryCreateheadPhonesInput | string[]
    headAddress?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BankGlossaryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    nameAz?: StringFieldUpdateOperationsInput | string
    voen?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    correspondentIban?: NullableStringFieldUpdateOperationsInput | string | null
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    headPhones?: BankGlossaryUpdateheadPhonesInput | string[]
    headAddress?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankGlossaryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    nameAz?: StringFieldUpdateOperationsInput | string
    voen?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    correspondentIban?: NullableStringFieldUpdateOperationsInput | string | null
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    headPhones?: BankGlossaryUpdateheadPhonesInput | string[]
    headAddress?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankBranchCreateInput = {
    id?: string
    branchCode: string
    name: string
    swift?: string | null
    address?: string | null
    phones?: BankBranchCreatephonesInput | string[]
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    bank: BankGlossaryCreateNestedOneWithoutBranchesInput
  }

  export type BankBranchUncheckedCreateInput = {
    id?: string
    bankId: string
    branchCode: string
    name: string
    swift?: string | null
    address?: string | null
    phones?: BankBranchCreatephonesInput | string[]
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BankBranchUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    branchCode?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phones?: BankBranchUpdatephonesInput | string[]
    isHeadOffice?: BoolFieldUpdateOperationsInput | boolean
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    bank?: BankGlossaryUpdateOneRequiredWithoutBranchesNestedInput
  }

  export type BankBranchUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankId?: StringFieldUpdateOperationsInput | string
    branchCode?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phones?: BankBranchUpdatephonesInput | string[]
    isHeadOffice?: BoolFieldUpdateOperationsInput | boolean
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankBranchCreateManyInput = {
    id?: string
    bankId: string
    branchCode: string
    name: string
    swift?: string | null
    address?: string | null
    phones?: BankBranchCreatephonesInput | string[]
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BankBranchUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    branchCode?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phones?: BankBranchUpdatephonesInput | string[]
    isHeadOffice?: BoolFieldUpdateOperationsInput | boolean
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankBranchUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankId?: StringFieldUpdateOperationsInput | string
    branchCode?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phones?: BankBranchUpdatephonesInput | string[]
    isHeadOffice?: BoolFieldUpdateOperationsInput | boolean
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomsTariffRateCreateInput = {
    id?: string
    hsCode: string
    description?: string | null
    dutyRatePercent: Decimal | DecimalJsLike | number | string
    vatRatePercent: Decimal | DecimalJsLike | number | string
    excisePercent?: Decimal | DecimalJsLike | number | string
    effectiveFrom: Date | string
    effectiveTo?: Date | string | null
    notes?: string | null
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CustomsTariffRateUncheckedCreateInput = {
    id?: string
    hsCode: string
    description?: string | null
    dutyRatePercent: Decimal | DecimalJsLike | number | string
    vatRatePercent: Decimal | DecimalJsLike | number | string
    excisePercent?: Decimal | DecimalJsLike | number | string
    effectiveFrom: Date | string
    effectiveTo?: Date | string | null
    notes?: string | null
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CustomsTariffRateUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    hsCode?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    dutyRatePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    vatRatePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    excisePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFieldUpdateOperationsInput | Date | string
    effectiveTo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomsTariffRateUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    hsCode?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    dutyRatePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    vatRatePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    excisePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFieldUpdateOperationsInput | Date | string
    effectiveTo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomsTariffRateCreateManyInput = {
    id?: string
    hsCode: string
    description?: string | null
    dutyRatePercent: Decimal | DecimalJsLike | number | string
    vatRatePercent: Decimal | DecimalJsLike | number | string
    excisePercent?: Decimal | DecimalJsLike | number | string
    effectiveFrom: Date | string
    effectiveTo?: Date | string | null
    notes?: string | null
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CustomsTariffRateUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    hsCode?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    dutyRatePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    vatRatePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    excisePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFieldUpdateOperationsInput | Date | string
    effectiveTo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomsTariffRateUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    hsCode?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    dutyRatePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    vatRatePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    excisePercent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFieldUpdateOperationsInput | Date | string
    effectiveTo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UnitOfMeasureCreateInput = {
    id?: string
    code: string
    kind: $Enums.UnitOfMeasureKind
    baseCode?: string | null
    factor?: Decimal | DecimalJsLike | number | string
    nameAz: string
    nameRu: string
    nameEn: string
    isActive?: boolean
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UnitOfMeasureUncheckedCreateInput = {
    id?: string
    code: string
    kind: $Enums.UnitOfMeasureKind
    baseCode?: string | null
    factor?: Decimal | DecimalJsLike | number | string
    nameAz: string
    nameRu: string
    nameEn: string
    isActive?: boolean
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UnitOfMeasureUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    kind?: EnumUnitOfMeasureKindFieldUpdateOperationsInput | $Enums.UnitOfMeasureKind
    baseCode?: NullableStringFieldUpdateOperationsInput | string | null
    factor?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UnitOfMeasureUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    kind?: EnumUnitOfMeasureKindFieldUpdateOperationsInput | $Enums.UnitOfMeasureKind
    baseCode?: NullableStringFieldUpdateOperationsInput | string | null
    factor?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UnitOfMeasureCreateManyInput = {
    id?: string
    code: string
    kind: $Enums.UnitOfMeasureKind
    baseCode?: string | null
    factor?: Decimal | DecimalJsLike | number | string
    nameAz: string
    nameRu: string
    nameEn: string
    isActive?: boolean
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UnitOfMeasureUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    kind?: EnumUnitOfMeasureKindFieldUpdateOperationsInput | $Enums.UnitOfMeasureKind
    baseCode?: NullableStringFieldUpdateOperationsInput | string | null
    factor?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UnitOfMeasureUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    kind?: EnumUnitOfMeasureKindFieldUpdateOperationsInput | $Enums.UnitOfMeasureKind
    baseCode?: NullableStringFieldUpdateOperationsInput | string | null
    factor?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CurrencyCreateInput = {
    id?: string
    code: string
    symbol: string
    decimals?: number
    nameAz: string
    nameRu: string
    nameEn: string
    isActive?: boolean
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CurrencyUncheckedCreateInput = {
    id?: string
    code: string
    symbol: string
    decimals?: number
    nameAz: string
    nameRu: string
    nameEn: string
    isActive?: boolean
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CurrencyUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    symbol?: StringFieldUpdateOperationsInput | string
    decimals?: IntFieldUpdateOperationsInput | number
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CurrencyUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    symbol?: StringFieldUpdateOperationsInput | string
    decimals?: IntFieldUpdateOperationsInput | number
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CurrencyCreateManyInput = {
    id?: string
    code: string
    symbol: string
    decimals?: number
    nameAz: string
    nameRu: string
    nameEn: string
    isActive?: boolean
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CurrencyUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    symbol?: StringFieldUpdateOperationsInput | string
    decimals?: IntFieldUpdateOperationsInput | number
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CurrencyUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    symbol?: StringFieldUpdateOperationsInput | string
    decimals?: IntFieldUpdateOperationsInput | number
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CountryCreateInput = {
    id?: string
    iso2: string
    iso3?: string | null
    dialingCode?: string | null
    currencyCode?: string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    cities?: CityCreateNestedManyWithoutCountryInput
  }

  export type CountryUncheckedCreateInput = {
    id?: string
    iso2: string
    iso3?: string | null
    dialingCode?: string | null
    currencyCode?: string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    cities?: CityUncheckedCreateNestedManyWithoutCountryInput
  }

  export type CountryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    iso2?: StringFieldUpdateOperationsInput | string
    iso3?: NullableStringFieldUpdateOperationsInput | string | null
    dialingCode?: NullableStringFieldUpdateOperationsInput | string | null
    currencyCode?: NullableStringFieldUpdateOperationsInput | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cities?: CityUpdateManyWithoutCountryNestedInput
  }

  export type CountryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    iso2?: StringFieldUpdateOperationsInput | string
    iso3?: NullableStringFieldUpdateOperationsInput | string | null
    dialingCode?: NullableStringFieldUpdateOperationsInput | string | null
    currencyCode?: NullableStringFieldUpdateOperationsInput | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cities?: CityUncheckedUpdateManyWithoutCountryNestedInput
  }

  export type CountryCreateManyInput = {
    id?: string
    iso2: string
    iso3?: string | null
    dialingCode?: string | null
    currencyCode?: string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CountryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    iso2?: StringFieldUpdateOperationsInput | string
    iso3?: NullableStringFieldUpdateOperationsInput | string | null
    dialingCode?: NullableStringFieldUpdateOperationsInput | string | null
    currencyCode?: NullableStringFieldUpdateOperationsInput | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CountryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    iso2?: StringFieldUpdateOperationsInput | string
    iso3?: NullableStringFieldUpdateOperationsInput | string | null
    dialingCode?: NullableStringFieldUpdateOperationsInput | string | null
    currencyCode?: NullableStringFieldUpdateOperationsInput | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CityCreateInput = {
    id?: string
    code: string
    region?: string | null
    isCapital?: boolean
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    country: CountryCreateNestedOneWithoutCitiesInput
  }

  export type CityUncheckedCreateInput = {
    id?: string
    code: string
    countryIso2: string
    region?: string | null
    isCapital?: boolean
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CityUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    region?: NullableStringFieldUpdateOperationsInput | string | null
    isCapital?: BoolFieldUpdateOperationsInput | boolean
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    country?: CountryUpdateOneRequiredWithoutCitiesNestedInput
  }

  export type CityUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    countryIso2?: StringFieldUpdateOperationsInput | string
    region?: NullableStringFieldUpdateOperationsInput | string | null
    isCapital?: BoolFieldUpdateOperationsInput | boolean
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CityCreateManyInput = {
    id?: string
    code: string
    countryIso2: string
    region?: string | null
    isCapital?: boolean
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CityUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    region?: NullableStringFieldUpdateOperationsInput | string | null
    isCapital?: BoolFieldUpdateOperationsInput | boolean
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CityUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    countryIso2?: StringFieldUpdateOperationsInput | string
    region?: NullableStringFieldUpdateOperationsInput | string | null
    isCapital?: BoolFieldUpdateOperationsInput | boolean
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TaxRateCreateInput = {
    id?: string
    code: string
    kind: $Enums.TaxRateKind
    region?: string
    percent: Decimal | DecimalJsLike | number | string
    effectiveFrom: Date | string
    effectiveTo?: Date | string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TaxRateUncheckedCreateInput = {
    id?: string
    code: string
    kind: $Enums.TaxRateKind
    region?: string
    percent: Decimal | DecimalJsLike | number | string
    effectiveFrom: Date | string
    effectiveTo?: Date | string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TaxRateUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    kind?: EnumTaxRateKindFieldUpdateOperationsInput | $Enums.TaxRateKind
    region?: StringFieldUpdateOperationsInput | string
    percent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFieldUpdateOperationsInput | Date | string
    effectiveTo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TaxRateUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    kind?: EnumTaxRateKindFieldUpdateOperationsInput | $Enums.TaxRateKind
    region?: StringFieldUpdateOperationsInput | string
    percent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFieldUpdateOperationsInput | Date | string
    effectiveTo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TaxRateCreateManyInput = {
    id?: string
    code: string
    kind: $Enums.TaxRateKind
    region?: string
    percent: Decimal | DecimalJsLike | number | string
    effectiveFrom: Date | string
    effectiveTo?: Date | string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TaxRateUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    kind?: EnumTaxRateKindFieldUpdateOperationsInput | $Enums.TaxRateKind
    region?: StringFieldUpdateOperationsInput | string
    percent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFieldUpdateOperationsInput | Date | string
    effectiveTo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TaxRateUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    kind?: EnumTaxRateKindFieldUpdateOperationsInput | $Enums.TaxRateKind
    region?: StringFieldUpdateOperationsInput | string
    percent?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    effectiveFrom?: DateTimeFieldUpdateOperationsInput | Date | string
    effectiveTo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UuidFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidFilter<$PrismaModel> | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type CalendarDayCountryDateCompoundUniqueInput = {
    country: string
    date: Date | string
  }

  export type CalendarDayCountOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    date?: SortOrder
    isWorking?: SortOrder
    dayType?: SortOrder
    labelAz?: SortOrder
    labelRu?: SortOrder
    labelEn?: SortOrder
    source?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CalendarDayMaxOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    date?: SortOrder
    isWorking?: SortOrder
    dayType?: SortOrder
    labelAz?: SortOrder
    labelRu?: SortOrder
    labelEn?: SortOrder
    source?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CalendarDayMinOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    date?: SortOrder
    isWorking?: SortOrder
    dayType?: SortOrder
    labelAz?: SortOrder
    labelRu?: SortOrder
    labelEn?: SortOrder
    source?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UuidWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type EnumCbarRateStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.CbarRateStatus | EnumCbarRateStatusFieldRefInput<$PrismaModel>
    in?: $Enums.CbarRateStatus[] | ListEnumCbarRateStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.CbarRateStatus[] | ListEnumCbarRateStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumCbarRateStatusFilter<$PrismaModel> | $Enums.CbarRateStatus
  }

  export type CbarOfficialRateRateDateCurrencyCodeCompoundUniqueInput = {
    rateDate: Date | string
    currencyCode: string
  }

  export type CbarOfficialRateCountOrderByAggregateInput = {
    id?: SortOrder
    rateDate?: SortOrder
    currencyCode?: SortOrder
    value?: SortOrder
    nominal?: SortOrder
    rate?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CbarOfficialRateAvgOrderByAggregateInput = {
    value?: SortOrder
    nominal?: SortOrder
    rate?: SortOrder
  }

  export type CbarOfficialRateMaxOrderByAggregateInput = {
    id?: SortOrder
    rateDate?: SortOrder
    currencyCode?: SortOrder
    value?: SortOrder
    nominal?: SortOrder
    rate?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CbarOfficialRateMinOrderByAggregateInput = {
    id?: SortOrder
    rateDate?: SortOrder
    currencyCode?: SortOrder
    value?: SortOrder
    nominal?: SortOrder
    rate?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CbarOfficialRateSumOrderByAggregateInput = {
    value?: SortOrder
    nominal?: SortOrder
    rate?: SortOrder
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type EnumCbarRateStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.CbarRateStatus | EnumCbarRateStatusFieldRefInput<$PrismaModel>
    in?: $Enums.CbarRateStatus[] | ListEnumCbarRateStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.CbarRateStatus[] | ListEnumCbarRateStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumCbarRateStatusWithAggregatesFilter<$PrismaModel> | $Enums.CbarRateStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumCbarRateStatusFilter<$PrismaModel>
    _max?: NestedEnumCbarRateStatusFilter<$PrismaModel>
  }

  export type EnumCounterpartyLegalFormNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.CounterpartyLegalForm | EnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    in?: $Enums.CounterpartyLegalForm[] | ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.CounterpartyLegalForm[] | ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    not?: NestedEnumCounterpartyLegalFormNullableFilter<$PrismaModel> | $Enums.CounterpartyLegalForm | null
  }

  export type GlobalCompanyDirectoryCountOrderByAggregateInput = {
    id?: SortOrder
    taxId?: SortOrder
    name?: SortOrder
    legalForm?: SortOrder
    legalAddress?: SortOrder
    phone?: SortOrder
    directorName?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GlobalCompanyDirectoryMaxOrderByAggregateInput = {
    id?: SortOrder
    taxId?: SortOrder
    name?: SortOrder
    legalForm?: SortOrder
    legalAddress?: SortOrder
    phone?: SortOrder
    directorName?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GlobalCompanyDirectoryMinOrderByAggregateInput = {
    id?: SortOrder
    taxId?: SortOrder
    name?: SortOrder
    legalForm?: SortOrder
    legalAddress?: SortOrder
    phone?: SortOrder
    directorName?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumCounterpartyLegalFormNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.CounterpartyLegalForm | EnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    in?: $Enums.CounterpartyLegalForm[] | ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.CounterpartyLegalForm[] | ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    not?: NestedEnumCounterpartyLegalFormNullableWithAggregatesFilter<$PrismaModel> | $Enums.CounterpartyLegalForm | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumCounterpartyLegalFormNullableFilter<$PrismaModel>
    _max?: NestedEnumCounterpartyLegalFormNullableFilter<$PrismaModel>
  }

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    has?: string | StringFieldRefInput<$PrismaModel> | null
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type BankBranchListRelationFilter = {
    every?: BankBranchWhereInput
    some?: BankBranchWhereInput
    none?: BankBranchWhereInput
  }

  export type BankBranchOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type BankGlossaryCountOrderByAggregateInput = {
    id?: SortOrder
    nameAz?: SortOrder
    voen?: SortOrder
    code?: SortOrder
    correspondentIban?: SortOrder
    swift?: SortOrder
    headPhones?: SortOrder
    headAddress?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BankGlossaryMaxOrderByAggregateInput = {
    id?: SortOrder
    nameAz?: SortOrder
    voen?: SortOrder
    code?: SortOrder
    correspondentIban?: SortOrder
    swift?: SortOrder
    headAddress?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BankGlossaryMinOrderByAggregateInput = {
    id?: SortOrder
    nameAz?: SortOrder
    voen?: SortOrder
    code?: SortOrder
    correspondentIban?: SortOrder
    swift?: SortOrder
    headAddress?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BankGlossaryScalarRelationFilter = {
    is?: BankGlossaryWhereInput
    isNot?: BankGlossaryWhereInput
  }

  export type BankBranchBankIdBranchCodeCompoundUniqueInput = {
    bankId: string
    branchCode: string
  }

  export type BankBranchCountOrderByAggregateInput = {
    id?: SortOrder
    bankId?: SortOrder
    branchCode?: SortOrder
    name?: SortOrder
    swift?: SortOrder
    address?: SortOrder
    phones?: SortOrder
    isHeadOffice?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BankBranchMaxOrderByAggregateInput = {
    id?: SortOrder
    bankId?: SortOrder
    branchCode?: SortOrder
    name?: SortOrder
    swift?: SortOrder
    address?: SortOrder
    isHeadOffice?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BankBranchMinOrderByAggregateInput = {
    id?: SortOrder
    bankId?: SortOrder
    branchCode?: SortOrder
    name?: SortOrder
    swift?: SortOrder
    address?: SortOrder
    isHeadOffice?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type CustomsTariffRateHsCodeEffectiveFromCompoundUniqueInput = {
    hsCode: string
    effectiveFrom: Date | string
  }

  export type CustomsTariffRateCountOrderByAggregateInput = {
    id?: SortOrder
    hsCode?: SortOrder
    description?: SortOrder
    dutyRatePercent?: SortOrder
    vatRatePercent?: SortOrder
    excisePercent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrder
    notes?: SortOrder
    deletedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CustomsTariffRateAvgOrderByAggregateInput = {
    dutyRatePercent?: SortOrder
    vatRatePercent?: SortOrder
    excisePercent?: SortOrder
  }

  export type CustomsTariffRateMaxOrderByAggregateInput = {
    id?: SortOrder
    hsCode?: SortOrder
    description?: SortOrder
    dutyRatePercent?: SortOrder
    vatRatePercent?: SortOrder
    excisePercent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrder
    notes?: SortOrder
    deletedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CustomsTariffRateMinOrderByAggregateInput = {
    id?: SortOrder
    hsCode?: SortOrder
    description?: SortOrder
    dutyRatePercent?: SortOrder
    vatRatePercent?: SortOrder
    excisePercent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrder
    notes?: SortOrder
    deletedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CustomsTariffRateSumOrderByAggregateInput = {
    dutyRatePercent?: SortOrder
    vatRatePercent?: SortOrder
    excisePercent?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type EnumUnitOfMeasureKindFilter<$PrismaModel = never> = {
    equals?: $Enums.UnitOfMeasureKind | EnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    in?: $Enums.UnitOfMeasureKind[] | ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.UnitOfMeasureKind[] | ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    not?: NestedEnumUnitOfMeasureKindFilter<$PrismaModel> | $Enums.UnitOfMeasureKind
  }

  export type UnitOfMeasureCountOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    baseCode?: SortOrder
    factor?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UnitOfMeasureAvgOrderByAggregateInput = {
    factor?: SortOrder
    sortOrder?: SortOrder
  }

  export type UnitOfMeasureMaxOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    baseCode?: SortOrder
    factor?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UnitOfMeasureMinOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    baseCode?: SortOrder
    factor?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UnitOfMeasureSumOrderByAggregateInput = {
    factor?: SortOrder
    sortOrder?: SortOrder
  }

  export type EnumUnitOfMeasureKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UnitOfMeasureKind | EnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    in?: $Enums.UnitOfMeasureKind[] | ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.UnitOfMeasureKind[] | ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    not?: NestedEnumUnitOfMeasureKindWithAggregatesFilter<$PrismaModel> | $Enums.UnitOfMeasureKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUnitOfMeasureKindFilter<$PrismaModel>
    _max?: NestedEnumUnitOfMeasureKindFilter<$PrismaModel>
  }

  export type CurrencyCountOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    symbol?: SortOrder
    decimals?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CurrencyAvgOrderByAggregateInput = {
    decimals?: SortOrder
    sortOrder?: SortOrder
  }

  export type CurrencyMaxOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    symbol?: SortOrder
    decimals?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CurrencyMinOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    symbol?: SortOrder
    decimals?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    isActive?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CurrencySumOrderByAggregateInput = {
    decimals?: SortOrder
    sortOrder?: SortOrder
  }

  export type CityListRelationFilter = {
    every?: CityWhereInput
    some?: CityWhereInput
    none?: CityWhereInput
  }

  export type CityOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CountryCountOrderByAggregateInput = {
    id?: SortOrder
    iso2?: SortOrder
    iso3?: SortOrder
    dialingCode?: SortOrder
    currencyCode?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CountryAvgOrderByAggregateInput = {
    sortOrder?: SortOrder
  }

  export type CountryMaxOrderByAggregateInput = {
    id?: SortOrder
    iso2?: SortOrder
    iso3?: SortOrder
    dialingCode?: SortOrder
    currencyCode?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CountryMinOrderByAggregateInput = {
    id?: SortOrder
    iso2?: SortOrder
    iso3?: SortOrder
    dialingCode?: SortOrder
    currencyCode?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CountrySumOrderByAggregateInput = {
    sortOrder?: SortOrder
  }

  export type CountryScalarRelationFilter = {
    is?: CountryWhereInput
    isNot?: CountryWhereInput
  }

  export type CityCountOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    countryIso2?: SortOrder
    region?: SortOrder
    isCapital?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CityAvgOrderByAggregateInput = {
    sortOrder?: SortOrder
  }

  export type CityMaxOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    countryIso2?: SortOrder
    region?: SortOrder
    isCapital?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CityMinOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    countryIso2?: SortOrder
    region?: SortOrder
    isCapital?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CitySumOrderByAggregateInput = {
    sortOrder?: SortOrder
  }

  export type EnumTaxRateKindFilter<$PrismaModel = never> = {
    equals?: $Enums.TaxRateKind | EnumTaxRateKindFieldRefInput<$PrismaModel>
    in?: $Enums.TaxRateKind[] | ListEnumTaxRateKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.TaxRateKind[] | ListEnumTaxRateKindFieldRefInput<$PrismaModel>
    not?: NestedEnumTaxRateKindFilter<$PrismaModel> | $Enums.TaxRateKind
  }

  export type TaxRateCountOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    region?: SortOrder
    percent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TaxRateAvgOrderByAggregateInput = {
    percent?: SortOrder
    sortOrder?: SortOrder
  }

  export type TaxRateMaxOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    region?: SortOrder
    percent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TaxRateMinOrderByAggregateInput = {
    id?: SortOrder
    code?: SortOrder
    kind?: SortOrder
    region?: SortOrder
    percent?: SortOrder
    effectiveFrom?: SortOrder
    effectiveTo?: SortOrder
    nameAz?: SortOrder
    nameRu?: SortOrder
    nameEn?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TaxRateSumOrderByAggregateInput = {
    percent?: SortOrder
    sortOrder?: SortOrder
  }

  export type EnumTaxRateKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.TaxRateKind | EnumTaxRateKindFieldRefInput<$PrismaModel>
    in?: $Enums.TaxRateKind[] | ListEnumTaxRateKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.TaxRateKind[] | ListEnumTaxRateKindFieldRefInput<$PrismaModel>
    not?: NestedEnumTaxRateKindWithAggregatesFilter<$PrismaModel> | $Enums.TaxRateKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumTaxRateKindFilter<$PrismaModel>
    _max?: NestedEnumTaxRateKindFilter<$PrismaModel>
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type EnumCbarRateStatusFieldUpdateOperationsInput = {
    set?: $Enums.CbarRateStatus
  }

  export type NullableEnumCounterpartyLegalFormFieldUpdateOperationsInput = {
    set?: $Enums.CounterpartyLegalForm | null
  }

  export type BankGlossaryCreateheadPhonesInput = {
    set: string[]
  }

  export type BankBranchCreateNestedManyWithoutBankInput = {
    create?: XOR<BankBranchCreateWithoutBankInput, BankBranchUncheckedCreateWithoutBankInput> | BankBranchCreateWithoutBankInput[] | BankBranchUncheckedCreateWithoutBankInput[]
    connectOrCreate?: BankBranchCreateOrConnectWithoutBankInput | BankBranchCreateOrConnectWithoutBankInput[]
    createMany?: BankBranchCreateManyBankInputEnvelope
    connect?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
  }

  export type BankBranchUncheckedCreateNestedManyWithoutBankInput = {
    create?: XOR<BankBranchCreateWithoutBankInput, BankBranchUncheckedCreateWithoutBankInput> | BankBranchCreateWithoutBankInput[] | BankBranchUncheckedCreateWithoutBankInput[]
    connectOrCreate?: BankBranchCreateOrConnectWithoutBankInput | BankBranchCreateOrConnectWithoutBankInput[]
    createMany?: BankBranchCreateManyBankInputEnvelope
    connect?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
  }

  export type BankGlossaryUpdateheadPhonesInput = {
    set?: string[]
    push?: string | string[]
  }

  export type BankBranchUpdateManyWithoutBankNestedInput = {
    create?: XOR<BankBranchCreateWithoutBankInput, BankBranchUncheckedCreateWithoutBankInput> | BankBranchCreateWithoutBankInput[] | BankBranchUncheckedCreateWithoutBankInput[]
    connectOrCreate?: BankBranchCreateOrConnectWithoutBankInput | BankBranchCreateOrConnectWithoutBankInput[]
    upsert?: BankBranchUpsertWithWhereUniqueWithoutBankInput | BankBranchUpsertWithWhereUniqueWithoutBankInput[]
    createMany?: BankBranchCreateManyBankInputEnvelope
    set?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
    disconnect?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
    delete?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
    connect?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
    update?: BankBranchUpdateWithWhereUniqueWithoutBankInput | BankBranchUpdateWithWhereUniqueWithoutBankInput[]
    updateMany?: BankBranchUpdateManyWithWhereWithoutBankInput | BankBranchUpdateManyWithWhereWithoutBankInput[]
    deleteMany?: BankBranchScalarWhereInput | BankBranchScalarWhereInput[]
  }

  export type BankBranchUncheckedUpdateManyWithoutBankNestedInput = {
    create?: XOR<BankBranchCreateWithoutBankInput, BankBranchUncheckedCreateWithoutBankInput> | BankBranchCreateWithoutBankInput[] | BankBranchUncheckedCreateWithoutBankInput[]
    connectOrCreate?: BankBranchCreateOrConnectWithoutBankInput | BankBranchCreateOrConnectWithoutBankInput[]
    upsert?: BankBranchUpsertWithWhereUniqueWithoutBankInput | BankBranchUpsertWithWhereUniqueWithoutBankInput[]
    createMany?: BankBranchCreateManyBankInputEnvelope
    set?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
    disconnect?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
    delete?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
    connect?: BankBranchWhereUniqueInput | BankBranchWhereUniqueInput[]
    update?: BankBranchUpdateWithWhereUniqueWithoutBankInput | BankBranchUpdateWithWhereUniqueWithoutBankInput[]
    updateMany?: BankBranchUpdateManyWithWhereWithoutBankInput | BankBranchUpdateManyWithWhereWithoutBankInput[]
    deleteMany?: BankBranchScalarWhereInput | BankBranchScalarWhereInput[]
  }

  export type BankBranchCreatephonesInput = {
    set: string[]
  }

  export type BankGlossaryCreateNestedOneWithoutBranchesInput = {
    create?: XOR<BankGlossaryCreateWithoutBranchesInput, BankGlossaryUncheckedCreateWithoutBranchesInput>
    connectOrCreate?: BankGlossaryCreateOrConnectWithoutBranchesInput
    connect?: BankGlossaryWhereUniqueInput
  }

  export type BankBranchUpdatephonesInput = {
    set?: string[]
    push?: string | string[]
  }

  export type BankGlossaryUpdateOneRequiredWithoutBranchesNestedInput = {
    create?: XOR<BankGlossaryCreateWithoutBranchesInput, BankGlossaryUncheckedCreateWithoutBranchesInput>
    connectOrCreate?: BankGlossaryCreateOrConnectWithoutBranchesInput
    upsert?: BankGlossaryUpsertWithoutBranchesInput
    connect?: BankGlossaryWhereUniqueInput
    update?: XOR<XOR<BankGlossaryUpdateToOneWithWhereWithoutBranchesInput, BankGlossaryUpdateWithoutBranchesInput>, BankGlossaryUncheckedUpdateWithoutBranchesInput>
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type EnumUnitOfMeasureKindFieldUpdateOperationsInput = {
    set?: $Enums.UnitOfMeasureKind
  }

  export type CityCreateNestedManyWithoutCountryInput = {
    create?: XOR<CityCreateWithoutCountryInput, CityUncheckedCreateWithoutCountryInput> | CityCreateWithoutCountryInput[] | CityUncheckedCreateWithoutCountryInput[]
    connectOrCreate?: CityCreateOrConnectWithoutCountryInput | CityCreateOrConnectWithoutCountryInput[]
    createMany?: CityCreateManyCountryInputEnvelope
    connect?: CityWhereUniqueInput | CityWhereUniqueInput[]
  }

  export type CityUncheckedCreateNestedManyWithoutCountryInput = {
    create?: XOR<CityCreateWithoutCountryInput, CityUncheckedCreateWithoutCountryInput> | CityCreateWithoutCountryInput[] | CityUncheckedCreateWithoutCountryInput[]
    connectOrCreate?: CityCreateOrConnectWithoutCountryInput | CityCreateOrConnectWithoutCountryInput[]
    createMany?: CityCreateManyCountryInputEnvelope
    connect?: CityWhereUniqueInput | CityWhereUniqueInput[]
  }

  export type CityUpdateManyWithoutCountryNestedInput = {
    create?: XOR<CityCreateWithoutCountryInput, CityUncheckedCreateWithoutCountryInput> | CityCreateWithoutCountryInput[] | CityUncheckedCreateWithoutCountryInput[]
    connectOrCreate?: CityCreateOrConnectWithoutCountryInput | CityCreateOrConnectWithoutCountryInput[]
    upsert?: CityUpsertWithWhereUniqueWithoutCountryInput | CityUpsertWithWhereUniqueWithoutCountryInput[]
    createMany?: CityCreateManyCountryInputEnvelope
    set?: CityWhereUniqueInput | CityWhereUniqueInput[]
    disconnect?: CityWhereUniqueInput | CityWhereUniqueInput[]
    delete?: CityWhereUniqueInput | CityWhereUniqueInput[]
    connect?: CityWhereUniqueInput | CityWhereUniqueInput[]
    update?: CityUpdateWithWhereUniqueWithoutCountryInput | CityUpdateWithWhereUniqueWithoutCountryInput[]
    updateMany?: CityUpdateManyWithWhereWithoutCountryInput | CityUpdateManyWithWhereWithoutCountryInput[]
    deleteMany?: CityScalarWhereInput | CityScalarWhereInput[]
  }

  export type CityUncheckedUpdateManyWithoutCountryNestedInput = {
    create?: XOR<CityCreateWithoutCountryInput, CityUncheckedCreateWithoutCountryInput> | CityCreateWithoutCountryInput[] | CityUncheckedCreateWithoutCountryInput[]
    connectOrCreate?: CityCreateOrConnectWithoutCountryInput | CityCreateOrConnectWithoutCountryInput[]
    upsert?: CityUpsertWithWhereUniqueWithoutCountryInput | CityUpsertWithWhereUniqueWithoutCountryInput[]
    createMany?: CityCreateManyCountryInputEnvelope
    set?: CityWhereUniqueInput | CityWhereUniqueInput[]
    disconnect?: CityWhereUniqueInput | CityWhereUniqueInput[]
    delete?: CityWhereUniqueInput | CityWhereUniqueInput[]
    connect?: CityWhereUniqueInput | CityWhereUniqueInput[]
    update?: CityUpdateWithWhereUniqueWithoutCountryInput | CityUpdateWithWhereUniqueWithoutCountryInput[]
    updateMany?: CityUpdateManyWithWhereWithoutCountryInput | CityUpdateManyWithWhereWithoutCountryInput[]
    deleteMany?: CityScalarWhereInput | CityScalarWhereInput[]
  }

  export type CountryCreateNestedOneWithoutCitiesInput = {
    create?: XOR<CountryCreateWithoutCitiesInput, CountryUncheckedCreateWithoutCitiesInput>
    connectOrCreate?: CountryCreateOrConnectWithoutCitiesInput
    connect?: CountryWhereUniqueInput
  }

  export type CountryUpdateOneRequiredWithoutCitiesNestedInput = {
    create?: XOR<CountryCreateWithoutCitiesInput, CountryUncheckedCreateWithoutCitiesInput>
    connectOrCreate?: CountryCreateOrConnectWithoutCitiesInput
    upsert?: CountryUpsertWithoutCitiesInput
    connect?: CountryWhereUniqueInput
    update?: XOR<XOR<CountryUpdateToOneWithWhereWithoutCitiesInput, CountryUpdateWithoutCitiesInput>, CountryUncheckedUpdateWithoutCitiesInput>
  }

  export type EnumTaxRateKindFieldUpdateOperationsInput = {
    set?: $Enums.TaxRateKind
  }

  export type NestedUuidFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidFilter<$PrismaModel> | string
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedUuidWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedEnumCbarRateStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.CbarRateStatus | EnumCbarRateStatusFieldRefInput<$PrismaModel>
    in?: $Enums.CbarRateStatus[] | ListEnumCbarRateStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.CbarRateStatus[] | ListEnumCbarRateStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumCbarRateStatusFilter<$PrismaModel> | $Enums.CbarRateStatus
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedEnumCbarRateStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.CbarRateStatus | EnumCbarRateStatusFieldRefInput<$PrismaModel>
    in?: $Enums.CbarRateStatus[] | ListEnumCbarRateStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.CbarRateStatus[] | ListEnumCbarRateStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumCbarRateStatusWithAggregatesFilter<$PrismaModel> | $Enums.CbarRateStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumCbarRateStatusFilter<$PrismaModel>
    _max?: NestedEnumCbarRateStatusFilter<$PrismaModel>
  }

  export type NestedEnumCounterpartyLegalFormNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.CounterpartyLegalForm | EnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    in?: $Enums.CounterpartyLegalForm[] | ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.CounterpartyLegalForm[] | ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    not?: NestedEnumCounterpartyLegalFormNullableFilter<$PrismaModel> | $Enums.CounterpartyLegalForm | null
  }

  export type NestedEnumCounterpartyLegalFormNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.CounterpartyLegalForm | EnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    in?: $Enums.CounterpartyLegalForm[] | ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.CounterpartyLegalForm[] | ListEnumCounterpartyLegalFormFieldRefInput<$PrismaModel> | null
    not?: NestedEnumCounterpartyLegalFormNullableWithAggregatesFilter<$PrismaModel> | $Enums.CounterpartyLegalForm | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumCounterpartyLegalFormNullableFilter<$PrismaModel>
    _max?: NestedEnumCounterpartyLegalFormNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumUnitOfMeasureKindFilter<$PrismaModel = never> = {
    equals?: $Enums.UnitOfMeasureKind | EnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    in?: $Enums.UnitOfMeasureKind[] | ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.UnitOfMeasureKind[] | ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    not?: NestedEnumUnitOfMeasureKindFilter<$PrismaModel> | $Enums.UnitOfMeasureKind
  }

  export type NestedEnumUnitOfMeasureKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UnitOfMeasureKind | EnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    in?: $Enums.UnitOfMeasureKind[] | ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.UnitOfMeasureKind[] | ListEnumUnitOfMeasureKindFieldRefInput<$PrismaModel>
    not?: NestedEnumUnitOfMeasureKindWithAggregatesFilter<$PrismaModel> | $Enums.UnitOfMeasureKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUnitOfMeasureKindFilter<$PrismaModel>
    _max?: NestedEnumUnitOfMeasureKindFilter<$PrismaModel>
  }

  export type NestedEnumTaxRateKindFilter<$PrismaModel = never> = {
    equals?: $Enums.TaxRateKind | EnumTaxRateKindFieldRefInput<$PrismaModel>
    in?: $Enums.TaxRateKind[] | ListEnumTaxRateKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.TaxRateKind[] | ListEnumTaxRateKindFieldRefInput<$PrismaModel>
    not?: NestedEnumTaxRateKindFilter<$PrismaModel> | $Enums.TaxRateKind
  }

  export type NestedEnumTaxRateKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.TaxRateKind | EnumTaxRateKindFieldRefInput<$PrismaModel>
    in?: $Enums.TaxRateKind[] | ListEnumTaxRateKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.TaxRateKind[] | ListEnumTaxRateKindFieldRefInput<$PrismaModel>
    not?: NestedEnumTaxRateKindWithAggregatesFilter<$PrismaModel> | $Enums.TaxRateKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumTaxRateKindFilter<$PrismaModel>
    _max?: NestedEnumTaxRateKindFilter<$PrismaModel>
  }

  export type BankBranchCreateWithoutBankInput = {
    id?: string
    branchCode: string
    name: string
    swift?: string | null
    address?: string | null
    phones?: BankBranchCreatephonesInput | string[]
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BankBranchUncheckedCreateWithoutBankInput = {
    id?: string
    branchCode: string
    name: string
    swift?: string | null
    address?: string | null
    phones?: BankBranchCreatephonesInput | string[]
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BankBranchCreateOrConnectWithoutBankInput = {
    where: BankBranchWhereUniqueInput
    create: XOR<BankBranchCreateWithoutBankInput, BankBranchUncheckedCreateWithoutBankInput>
  }

  export type BankBranchCreateManyBankInputEnvelope = {
    data: BankBranchCreateManyBankInput | BankBranchCreateManyBankInput[]
    skipDuplicates?: boolean
  }

  export type BankBranchUpsertWithWhereUniqueWithoutBankInput = {
    where: BankBranchWhereUniqueInput
    update: XOR<BankBranchUpdateWithoutBankInput, BankBranchUncheckedUpdateWithoutBankInput>
    create: XOR<BankBranchCreateWithoutBankInput, BankBranchUncheckedCreateWithoutBankInput>
  }

  export type BankBranchUpdateWithWhereUniqueWithoutBankInput = {
    where: BankBranchWhereUniqueInput
    data: XOR<BankBranchUpdateWithoutBankInput, BankBranchUncheckedUpdateWithoutBankInput>
  }

  export type BankBranchUpdateManyWithWhereWithoutBankInput = {
    where: BankBranchScalarWhereInput
    data: XOR<BankBranchUpdateManyMutationInput, BankBranchUncheckedUpdateManyWithoutBankInput>
  }

  export type BankBranchScalarWhereInput = {
    AND?: BankBranchScalarWhereInput | BankBranchScalarWhereInput[]
    OR?: BankBranchScalarWhereInput[]
    NOT?: BankBranchScalarWhereInput | BankBranchScalarWhereInput[]
    id?: UuidFilter<"BankBranch"> | string
    bankId?: UuidFilter<"BankBranch"> | string
    branchCode?: StringFilter<"BankBranch"> | string
    name?: StringFilter<"BankBranch"> | string
    swift?: StringNullableFilter<"BankBranch"> | string | null
    address?: StringNullableFilter<"BankBranch"> | string | null
    phones?: StringNullableListFilter<"BankBranch">
    isHeadOffice?: BoolFilter<"BankBranch"> | boolean
    isActive?: BoolFilter<"BankBranch"> | boolean
    createdAt?: DateTimeFilter<"BankBranch"> | Date | string
    updatedAt?: DateTimeFilter<"BankBranch"> | Date | string
  }

  export type BankGlossaryCreateWithoutBranchesInput = {
    id?: string
    nameAz: string
    voen: string
    code: string
    correspondentIban?: string | null
    swift?: string | null
    headPhones?: BankGlossaryCreateheadPhonesInput | string[]
    headAddress?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BankGlossaryUncheckedCreateWithoutBranchesInput = {
    id?: string
    nameAz: string
    voen: string
    code: string
    correspondentIban?: string | null
    swift?: string | null
    headPhones?: BankGlossaryCreateheadPhonesInput | string[]
    headAddress?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BankGlossaryCreateOrConnectWithoutBranchesInput = {
    where: BankGlossaryWhereUniqueInput
    create: XOR<BankGlossaryCreateWithoutBranchesInput, BankGlossaryUncheckedCreateWithoutBranchesInput>
  }

  export type BankGlossaryUpsertWithoutBranchesInput = {
    update: XOR<BankGlossaryUpdateWithoutBranchesInput, BankGlossaryUncheckedUpdateWithoutBranchesInput>
    create: XOR<BankGlossaryCreateWithoutBranchesInput, BankGlossaryUncheckedCreateWithoutBranchesInput>
    where?: BankGlossaryWhereInput
  }

  export type BankGlossaryUpdateToOneWithWhereWithoutBranchesInput = {
    where?: BankGlossaryWhereInput
    data: XOR<BankGlossaryUpdateWithoutBranchesInput, BankGlossaryUncheckedUpdateWithoutBranchesInput>
  }

  export type BankGlossaryUpdateWithoutBranchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    nameAz?: StringFieldUpdateOperationsInput | string
    voen?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    correspondentIban?: NullableStringFieldUpdateOperationsInput | string | null
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    headPhones?: BankGlossaryUpdateheadPhonesInput | string[]
    headAddress?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankGlossaryUncheckedUpdateWithoutBranchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    nameAz?: StringFieldUpdateOperationsInput | string
    voen?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    correspondentIban?: NullableStringFieldUpdateOperationsInput | string | null
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    headPhones?: BankGlossaryUpdateheadPhonesInput | string[]
    headAddress?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CityCreateWithoutCountryInput = {
    id?: string
    code: string
    region?: string | null
    isCapital?: boolean
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CityUncheckedCreateWithoutCountryInput = {
    id?: string
    code: string
    region?: string | null
    isCapital?: boolean
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CityCreateOrConnectWithoutCountryInput = {
    where: CityWhereUniqueInput
    create: XOR<CityCreateWithoutCountryInput, CityUncheckedCreateWithoutCountryInput>
  }

  export type CityCreateManyCountryInputEnvelope = {
    data: CityCreateManyCountryInput | CityCreateManyCountryInput[]
    skipDuplicates?: boolean
  }

  export type CityUpsertWithWhereUniqueWithoutCountryInput = {
    where: CityWhereUniqueInput
    update: XOR<CityUpdateWithoutCountryInput, CityUncheckedUpdateWithoutCountryInput>
    create: XOR<CityCreateWithoutCountryInput, CityUncheckedCreateWithoutCountryInput>
  }

  export type CityUpdateWithWhereUniqueWithoutCountryInput = {
    where: CityWhereUniqueInput
    data: XOR<CityUpdateWithoutCountryInput, CityUncheckedUpdateWithoutCountryInput>
  }

  export type CityUpdateManyWithWhereWithoutCountryInput = {
    where: CityScalarWhereInput
    data: XOR<CityUpdateManyMutationInput, CityUncheckedUpdateManyWithoutCountryInput>
  }

  export type CityScalarWhereInput = {
    AND?: CityScalarWhereInput | CityScalarWhereInput[]
    OR?: CityScalarWhereInput[]
    NOT?: CityScalarWhereInput | CityScalarWhereInput[]
    id?: UuidFilter<"City"> | string
    code?: StringFilter<"City"> | string
    countryIso2?: StringFilter<"City"> | string
    region?: StringNullableFilter<"City"> | string | null
    isCapital?: BoolFilter<"City"> | boolean
    nameAz?: StringFilter<"City"> | string
    nameRu?: StringFilter<"City"> | string
    nameEn?: StringFilter<"City"> | string
    sortOrder?: IntFilter<"City"> | number
    createdAt?: DateTimeFilter<"City"> | Date | string
    updatedAt?: DateTimeFilter<"City"> | Date | string
  }

  export type CountryCreateWithoutCitiesInput = {
    id?: string
    iso2: string
    iso3?: string | null
    dialingCode?: string | null
    currencyCode?: string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CountryUncheckedCreateWithoutCitiesInput = {
    id?: string
    iso2: string
    iso3?: string | null
    dialingCode?: string | null
    currencyCode?: string | null
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CountryCreateOrConnectWithoutCitiesInput = {
    where: CountryWhereUniqueInput
    create: XOR<CountryCreateWithoutCitiesInput, CountryUncheckedCreateWithoutCitiesInput>
  }

  export type CountryUpsertWithoutCitiesInput = {
    update: XOR<CountryUpdateWithoutCitiesInput, CountryUncheckedUpdateWithoutCitiesInput>
    create: XOR<CountryCreateWithoutCitiesInput, CountryUncheckedCreateWithoutCitiesInput>
    where?: CountryWhereInput
  }

  export type CountryUpdateToOneWithWhereWithoutCitiesInput = {
    where?: CountryWhereInput
    data: XOR<CountryUpdateWithoutCitiesInput, CountryUncheckedUpdateWithoutCitiesInput>
  }

  export type CountryUpdateWithoutCitiesInput = {
    id?: StringFieldUpdateOperationsInput | string
    iso2?: StringFieldUpdateOperationsInput | string
    iso3?: NullableStringFieldUpdateOperationsInput | string | null
    dialingCode?: NullableStringFieldUpdateOperationsInput | string | null
    currencyCode?: NullableStringFieldUpdateOperationsInput | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CountryUncheckedUpdateWithoutCitiesInput = {
    id?: StringFieldUpdateOperationsInput | string
    iso2?: StringFieldUpdateOperationsInput | string
    iso3?: NullableStringFieldUpdateOperationsInput | string | null
    dialingCode?: NullableStringFieldUpdateOperationsInput | string | null
    currencyCode?: NullableStringFieldUpdateOperationsInput | string | null
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankBranchCreateManyBankInput = {
    id?: string
    branchCode: string
    name: string
    swift?: string | null
    address?: string | null
    phones?: BankBranchCreatephonesInput | string[]
    isHeadOffice?: boolean
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BankBranchUpdateWithoutBankInput = {
    id?: StringFieldUpdateOperationsInput | string
    branchCode?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phones?: BankBranchUpdatephonesInput | string[]
    isHeadOffice?: BoolFieldUpdateOperationsInput | boolean
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankBranchUncheckedUpdateWithoutBankInput = {
    id?: StringFieldUpdateOperationsInput | string
    branchCode?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phones?: BankBranchUpdatephonesInput | string[]
    isHeadOffice?: BoolFieldUpdateOperationsInput | boolean
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BankBranchUncheckedUpdateManyWithoutBankInput = {
    id?: StringFieldUpdateOperationsInput | string
    branchCode?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    swift?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phones?: BankBranchUpdatephonesInput | string[]
    isHeadOffice?: BoolFieldUpdateOperationsInput | boolean
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CityCreateManyCountryInput = {
    id?: string
    code: string
    region?: string | null
    isCapital?: boolean
    nameAz: string
    nameRu: string
    nameEn: string
    sortOrder?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CityUpdateWithoutCountryInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    region?: NullableStringFieldUpdateOperationsInput | string | null
    isCapital?: BoolFieldUpdateOperationsInput | boolean
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CityUncheckedUpdateWithoutCountryInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    region?: NullableStringFieldUpdateOperationsInput | string | null
    isCapital?: BoolFieldUpdateOperationsInput | boolean
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CityUncheckedUpdateManyWithoutCountryInput = {
    id?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    region?: NullableStringFieldUpdateOperationsInput | string | null
    isCapital?: BoolFieldUpdateOperationsInput | boolean
    nameAz?: StringFieldUpdateOperationsInput | string
    nameRu?: StringFieldUpdateOperationsInput | string
    nameEn?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}