
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
 * Model GlobalNaturalPerson
 * 
 */
export type GlobalNaturalPerson = $Result.DefaultSelection<Prisma.$GlobalNaturalPersonPayload>
/**
 * Model PersonHrProfile
 * HR-only PII attributes (blood, marital, education, stats, photo). Finance reads via MDM API only.
 */
export type PersonHrProfile = $Result.DefaultSelection<Prisma.$PersonHrProfilePayload>
/**
 * Model PersonAddress
 * 
 */
export type PersonAddress = $Result.DefaultSelection<Prisma.$PersonAddressPayload>
/**
 * Model PersonIdentifier
 * 
 */
export type PersonIdentifier = $Result.DefaultSelection<Prisma.$PersonIdentifierPayload>
/**
 * Model GlobalLegalEntity
 * 
 */
export type GlobalLegalEntity = $Result.DefaultSelection<Prisma.$GlobalLegalEntityPayload>
/**
 * Model PersonAccessRequest
 * 
 */
export type PersonAccessRequest = $Result.DefaultSelection<Prisma.$PersonAccessRequestPayload>
/**
 * Model PersonAccessGrant
 * 
 */
export type PersonAccessGrant = $Result.DefaultSelection<Prisma.$PersonAccessGrantPayload>
/**
 * Model PersonAccessLog
 * 
 */
export type PersonAccessLog = $Result.DefaultSelection<Prisma.$PersonAccessLogPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const PersonAccessRequestStatus: {
  PENDING: 'PENDING',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED'
};

export type PersonAccessRequestStatus = (typeof PersonAccessRequestStatus)[keyof typeof PersonAccessRequestStatus]


export const PersonIdentifierType: {
  AZ_FIN: 'AZ_FIN',
  PASSPORT: 'PASSPORT',
  RESIDENCE_PERMIT: 'RESIDENCE_PERMIT',
  NATIONAL_ID: 'NATIONAL_ID',
  ERA_SURROGATE: 'ERA_SURROGATE'
};

export type PersonIdentifierType = (typeof PersonIdentifierType)[keyof typeof PersonIdentifierType]


export const IdentifierTrust: {
  SELF_DECLARED: 'SELF_DECLARED',
  DOCUMENT_SCANNED: 'DOCUMENT_SCANNED',
  GOVERNMENT_VERIFIED: 'GOVERNMENT_VERIFIED'
};

export type IdentifierTrust = (typeof IdentifierTrust)[keyof typeof IdentifierTrust]


export const PersonSegment: {
  CITIZEN: 'CITIZEN',
  FOREIGNER: 'FOREIGNER',
  UNVERIFIED: 'UNVERIFIED'
};

export type PersonSegment = (typeof PersonSegment)[keyof typeof PersonSegment]


export const PersonSex: {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  UNKNOWN: 'UNKNOWN'
};

export type PersonSex = (typeof PersonSex)[keyof typeof PersonSex]


export const BloodGroup: {
  A_POS: 'A_POS',
  A_NEG: 'A_NEG',
  B_POS: 'B_POS',
  B_NEG: 'B_NEG',
  AB_POS: 'AB_POS',
  AB_NEG: 'AB_NEG',
  O_POS: 'O_POS',
  O_NEG: 'O_NEG',
  UNKNOWN: 'UNKNOWN'
};

export type BloodGroup = (typeof BloodGroup)[keyof typeof BloodGroup]


export const MaritalStatus: {
  SINGLE: 'SINGLE',
  MARRIED: 'MARRIED',
  DIVORCED: 'DIVORCED',
  WIDOWED: 'WIDOWED',
  OTHER: 'OTHER'
};

export type MaritalStatus = (typeof MaritalStatus)[keyof typeof MaritalStatus]


export const PersonAddressKind: {
  REGISTRATION: 'REGISTRATION',
  ACTUAL: 'ACTUAL'
};

export type PersonAddressKind = (typeof PersonAddressKind)[keyof typeof PersonAddressKind]


export const StatisticalCategory: {
  REFUGEE: 'REFUGEE',
  IDP: 'IDP',
  MARTYR_FAMILY: 'MARTYR_FAMILY',
  VETERAN: 'VETERAN'
};

export type StatisticalCategory = (typeof StatisticalCategory)[keyof typeof StatisticalCategory]

}

export type PersonAccessRequestStatus = $Enums.PersonAccessRequestStatus

export const PersonAccessRequestStatus: typeof $Enums.PersonAccessRequestStatus

export type PersonIdentifierType = $Enums.PersonIdentifierType

export const PersonIdentifierType: typeof $Enums.PersonIdentifierType

export type IdentifierTrust = $Enums.IdentifierTrust

export const IdentifierTrust: typeof $Enums.IdentifierTrust

export type PersonSegment = $Enums.PersonSegment

export const PersonSegment: typeof $Enums.PersonSegment

export type PersonSex = $Enums.PersonSex

export const PersonSex: typeof $Enums.PersonSex

export type BloodGroup = $Enums.BloodGroup

export const BloodGroup: typeof $Enums.BloodGroup

export type MaritalStatus = $Enums.MaritalStatus

export const MaritalStatus: typeof $Enums.MaritalStatus

export type PersonAddressKind = $Enums.PersonAddressKind

export const PersonAddressKind: typeof $Enums.PersonAddressKind

export type StatisticalCategory = $Enums.StatisticalCategory

export const StatisticalCategory: typeof $Enums.StatisticalCategory

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more GlobalNaturalPeople
 * const globalNaturalPeople = await prisma.globalNaturalPerson.findMany()
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
   * // Fetch zero or more GlobalNaturalPeople
   * const globalNaturalPeople = await prisma.globalNaturalPerson.findMany()
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
   * `prisma.globalNaturalPerson`: Exposes CRUD operations for the **GlobalNaturalPerson** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more GlobalNaturalPeople
    * const globalNaturalPeople = await prisma.globalNaturalPerson.findMany()
    * ```
    */
  get globalNaturalPerson(): Prisma.GlobalNaturalPersonDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.personHrProfile`: Exposes CRUD operations for the **PersonHrProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PersonHrProfiles
    * const personHrProfiles = await prisma.personHrProfile.findMany()
    * ```
    */
  get personHrProfile(): Prisma.PersonHrProfileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.personAddress`: Exposes CRUD operations for the **PersonAddress** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PersonAddresses
    * const personAddresses = await prisma.personAddress.findMany()
    * ```
    */
  get personAddress(): Prisma.PersonAddressDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.personIdentifier`: Exposes CRUD operations for the **PersonIdentifier** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PersonIdentifiers
    * const personIdentifiers = await prisma.personIdentifier.findMany()
    * ```
    */
  get personIdentifier(): Prisma.PersonIdentifierDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.globalLegalEntity`: Exposes CRUD operations for the **GlobalLegalEntity** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more GlobalLegalEntities
    * const globalLegalEntities = await prisma.globalLegalEntity.findMany()
    * ```
    */
  get globalLegalEntity(): Prisma.GlobalLegalEntityDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.personAccessRequest`: Exposes CRUD operations for the **PersonAccessRequest** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PersonAccessRequests
    * const personAccessRequests = await prisma.personAccessRequest.findMany()
    * ```
    */
  get personAccessRequest(): Prisma.PersonAccessRequestDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.personAccessGrant`: Exposes CRUD operations for the **PersonAccessGrant** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PersonAccessGrants
    * const personAccessGrants = await prisma.personAccessGrant.findMany()
    * ```
    */
  get personAccessGrant(): Prisma.PersonAccessGrantDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.personAccessLog`: Exposes CRUD operations for the **PersonAccessLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PersonAccessLogs
    * const personAccessLogs = await prisma.personAccessLog.findMany()
    * ```
    */
  get personAccessLog(): Prisma.PersonAccessLogDelegate<ExtArgs, ClientOptions>;
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
    GlobalNaturalPerson: 'GlobalNaturalPerson',
    PersonHrProfile: 'PersonHrProfile',
    PersonAddress: 'PersonAddress',
    PersonIdentifier: 'PersonIdentifier',
    GlobalLegalEntity: 'GlobalLegalEntity',
    PersonAccessRequest: 'PersonAccessRequest',
    PersonAccessGrant: 'PersonAccessGrant',
    PersonAccessLog: 'PersonAccessLog'
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
      modelProps: "globalNaturalPerson" | "personHrProfile" | "personAddress" | "personIdentifier" | "globalLegalEntity" | "personAccessRequest" | "personAccessGrant" | "personAccessLog"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      GlobalNaturalPerson: {
        payload: Prisma.$GlobalNaturalPersonPayload<ExtArgs>
        fields: Prisma.GlobalNaturalPersonFieldRefs
        operations: {
          findUnique: {
            args: Prisma.GlobalNaturalPersonFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.GlobalNaturalPersonFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>
          }
          findFirst: {
            args: Prisma.GlobalNaturalPersonFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.GlobalNaturalPersonFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>
          }
          findMany: {
            args: Prisma.GlobalNaturalPersonFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>[]
          }
          create: {
            args: Prisma.GlobalNaturalPersonCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>
          }
          createMany: {
            args: Prisma.GlobalNaturalPersonCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.GlobalNaturalPersonCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>[]
          }
          delete: {
            args: Prisma.GlobalNaturalPersonDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>
          }
          update: {
            args: Prisma.GlobalNaturalPersonUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>
          }
          deleteMany: {
            args: Prisma.GlobalNaturalPersonDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.GlobalNaturalPersonUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.GlobalNaturalPersonUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>[]
          }
          upsert: {
            args: Prisma.GlobalNaturalPersonUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalNaturalPersonPayload>
          }
          aggregate: {
            args: Prisma.GlobalNaturalPersonAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGlobalNaturalPerson>
          }
          groupBy: {
            args: Prisma.GlobalNaturalPersonGroupByArgs<ExtArgs>
            result: $Utils.Optional<GlobalNaturalPersonGroupByOutputType>[]
          }
          count: {
            args: Prisma.GlobalNaturalPersonCountArgs<ExtArgs>
            result: $Utils.Optional<GlobalNaturalPersonCountAggregateOutputType> | number
          }
        }
      }
      PersonHrProfile: {
        payload: Prisma.$PersonHrProfilePayload<ExtArgs>
        fields: Prisma.PersonHrProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonHrProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonHrProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>
          }
          findFirst: {
            args: Prisma.PersonHrProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonHrProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>
          }
          findMany: {
            args: Prisma.PersonHrProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>[]
          }
          create: {
            args: Prisma.PersonHrProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>
          }
          createMany: {
            args: Prisma.PersonHrProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonHrProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>[]
          }
          delete: {
            args: Prisma.PersonHrProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>
          }
          update: {
            args: Prisma.PersonHrProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>
          }
          deleteMany: {
            args: Prisma.PersonHrProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonHrProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonHrProfileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>[]
          }
          upsert: {
            args: Prisma.PersonHrProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonHrProfilePayload>
          }
          aggregate: {
            args: Prisma.PersonHrProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersonHrProfile>
          }
          groupBy: {
            args: Prisma.PersonHrProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonHrProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonHrProfileCountArgs<ExtArgs>
            result: $Utils.Optional<PersonHrProfileCountAggregateOutputType> | number
          }
        }
      }
      PersonAddress: {
        payload: Prisma.$PersonAddressPayload<ExtArgs>
        fields: Prisma.PersonAddressFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonAddressFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonAddressFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>
          }
          findFirst: {
            args: Prisma.PersonAddressFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonAddressFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>
          }
          findMany: {
            args: Prisma.PersonAddressFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>[]
          }
          create: {
            args: Prisma.PersonAddressCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>
          }
          createMany: {
            args: Prisma.PersonAddressCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonAddressCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>[]
          }
          delete: {
            args: Prisma.PersonAddressDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>
          }
          update: {
            args: Prisma.PersonAddressUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>
          }
          deleteMany: {
            args: Prisma.PersonAddressDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonAddressUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonAddressUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>[]
          }
          upsert: {
            args: Prisma.PersonAddressUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAddressPayload>
          }
          aggregate: {
            args: Prisma.PersonAddressAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersonAddress>
          }
          groupBy: {
            args: Prisma.PersonAddressGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonAddressGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonAddressCountArgs<ExtArgs>
            result: $Utils.Optional<PersonAddressCountAggregateOutputType> | number
          }
        }
      }
      PersonIdentifier: {
        payload: Prisma.$PersonIdentifierPayload<ExtArgs>
        fields: Prisma.PersonIdentifierFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonIdentifierFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonIdentifierFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>
          }
          findFirst: {
            args: Prisma.PersonIdentifierFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonIdentifierFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>
          }
          findMany: {
            args: Prisma.PersonIdentifierFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>[]
          }
          create: {
            args: Prisma.PersonIdentifierCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>
          }
          createMany: {
            args: Prisma.PersonIdentifierCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonIdentifierCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>[]
          }
          delete: {
            args: Prisma.PersonIdentifierDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>
          }
          update: {
            args: Prisma.PersonIdentifierUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>
          }
          deleteMany: {
            args: Prisma.PersonIdentifierDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonIdentifierUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonIdentifierUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>[]
          }
          upsert: {
            args: Prisma.PersonIdentifierUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonIdentifierPayload>
          }
          aggregate: {
            args: Prisma.PersonIdentifierAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersonIdentifier>
          }
          groupBy: {
            args: Prisma.PersonIdentifierGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonIdentifierGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonIdentifierCountArgs<ExtArgs>
            result: $Utils.Optional<PersonIdentifierCountAggregateOutputType> | number
          }
        }
      }
      GlobalLegalEntity: {
        payload: Prisma.$GlobalLegalEntityPayload<ExtArgs>
        fields: Prisma.GlobalLegalEntityFieldRefs
        operations: {
          findUnique: {
            args: Prisma.GlobalLegalEntityFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.GlobalLegalEntityFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>
          }
          findFirst: {
            args: Prisma.GlobalLegalEntityFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.GlobalLegalEntityFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>
          }
          findMany: {
            args: Prisma.GlobalLegalEntityFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>[]
          }
          create: {
            args: Prisma.GlobalLegalEntityCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>
          }
          createMany: {
            args: Prisma.GlobalLegalEntityCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.GlobalLegalEntityCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>[]
          }
          delete: {
            args: Prisma.GlobalLegalEntityDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>
          }
          update: {
            args: Prisma.GlobalLegalEntityUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>
          }
          deleteMany: {
            args: Prisma.GlobalLegalEntityDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.GlobalLegalEntityUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.GlobalLegalEntityUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>[]
          }
          upsert: {
            args: Prisma.GlobalLegalEntityUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GlobalLegalEntityPayload>
          }
          aggregate: {
            args: Prisma.GlobalLegalEntityAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGlobalLegalEntity>
          }
          groupBy: {
            args: Prisma.GlobalLegalEntityGroupByArgs<ExtArgs>
            result: $Utils.Optional<GlobalLegalEntityGroupByOutputType>[]
          }
          count: {
            args: Prisma.GlobalLegalEntityCountArgs<ExtArgs>
            result: $Utils.Optional<GlobalLegalEntityCountAggregateOutputType> | number
          }
        }
      }
      PersonAccessRequest: {
        payload: Prisma.$PersonAccessRequestPayload<ExtArgs>
        fields: Prisma.PersonAccessRequestFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonAccessRequestFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonAccessRequestFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>
          }
          findFirst: {
            args: Prisma.PersonAccessRequestFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonAccessRequestFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>
          }
          findMany: {
            args: Prisma.PersonAccessRequestFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>[]
          }
          create: {
            args: Prisma.PersonAccessRequestCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>
          }
          createMany: {
            args: Prisma.PersonAccessRequestCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonAccessRequestCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>[]
          }
          delete: {
            args: Prisma.PersonAccessRequestDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>
          }
          update: {
            args: Prisma.PersonAccessRequestUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>
          }
          deleteMany: {
            args: Prisma.PersonAccessRequestDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonAccessRequestUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonAccessRequestUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>[]
          }
          upsert: {
            args: Prisma.PersonAccessRequestUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessRequestPayload>
          }
          aggregate: {
            args: Prisma.PersonAccessRequestAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersonAccessRequest>
          }
          groupBy: {
            args: Prisma.PersonAccessRequestGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonAccessRequestGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonAccessRequestCountArgs<ExtArgs>
            result: $Utils.Optional<PersonAccessRequestCountAggregateOutputType> | number
          }
        }
      }
      PersonAccessGrant: {
        payload: Prisma.$PersonAccessGrantPayload<ExtArgs>
        fields: Prisma.PersonAccessGrantFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonAccessGrantFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonAccessGrantFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>
          }
          findFirst: {
            args: Prisma.PersonAccessGrantFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonAccessGrantFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>
          }
          findMany: {
            args: Prisma.PersonAccessGrantFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>[]
          }
          create: {
            args: Prisma.PersonAccessGrantCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>
          }
          createMany: {
            args: Prisma.PersonAccessGrantCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonAccessGrantCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>[]
          }
          delete: {
            args: Prisma.PersonAccessGrantDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>
          }
          update: {
            args: Prisma.PersonAccessGrantUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>
          }
          deleteMany: {
            args: Prisma.PersonAccessGrantDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonAccessGrantUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonAccessGrantUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>[]
          }
          upsert: {
            args: Prisma.PersonAccessGrantUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessGrantPayload>
          }
          aggregate: {
            args: Prisma.PersonAccessGrantAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersonAccessGrant>
          }
          groupBy: {
            args: Prisma.PersonAccessGrantGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonAccessGrantGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonAccessGrantCountArgs<ExtArgs>
            result: $Utils.Optional<PersonAccessGrantCountAggregateOutputType> | number
          }
        }
      }
      PersonAccessLog: {
        payload: Prisma.$PersonAccessLogPayload<ExtArgs>
        fields: Prisma.PersonAccessLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonAccessLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonAccessLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>
          }
          findFirst: {
            args: Prisma.PersonAccessLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonAccessLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>
          }
          findMany: {
            args: Prisma.PersonAccessLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>[]
          }
          create: {
            args: Prisma.PersonAccessLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>
          }
          createMany: {
            args: Prisma.PersonAccessLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonAccessLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>[]
          }
          delete: {
            args: Prisma.PersonAccessLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>
          }
          update: {
            args: Prisma.PersonAccessLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>
          }
          deleteMany: {
            args: Prisma.PersonAccessLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonAccessLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonAccessLogUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>[]
          }
          upsert: {
            args: Prisma.PersonAccessLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonAccessLogPayload>
          }
          aggregate: {
            args: Prisma.PersonAccessLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersonAccessLog>
          }
          groupBy: {
            args: Prisma.PersonAccessLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonAccessLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonAccessLogCountArgs<ExtArgs>
            result: $Utils.Optional<PersonAccessLogCountAggregateOutputType> | number
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
    globalNaturalPerson?: GlobalNaturalPersonOmit
    personHrProfile?: PersonHrProfileOmit
    personAddress?: PersonAddressOmit
    personIdentifier?: PersonIdentifierOmit
    globalLegalEntity?: GlobalLegalEntityOmit
    personAccessRequest?: PersonAccessRequestOmit
    personAccessGrant?: PersonAccessGrantOmit
    personAccessLog?: PersonAccessLogOmit
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
   * Count Type GlobalNaturalPersonCountOutputType
   */

  export type GlobalNaturalPersonCountOutputType = {
    identifiers: number
    accessRequests: number
    accessGrants: number
    accessLogs: number
    addresses: number
    mergedFrom: number
  }

  export type GlobalNaturalPersonCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    identifiers?: boolean | GlobalNaturalPersonCountOutputTypeCountIdentifiersArgs
    accessRequests?: boolean | GlobalNaturalPersonCountOutputTypeCountAccessRequestsArgs
    accessGrants?: boolean | GlobalNaturalPersonCountOutputTypeCountAccessGrantsArgs
    accessLogs?: boolean | GlobalNaturalPersonCountOutputTypeCountAccessLogsArgs
    addresses?: boolean | GlobalNaturalPersonCountOutputTypeCountAddressesArgs
    mergedFrom?: boolean | GlobalNaturalPersonCountOutputTypeCountMergedFromArgs
  }

  // Custom InputTypes
  /**
   * GlobalNaturalPersonCountOutputType without action
   */
  export type GlobalNaturalPersonCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPersonCountOutputType
     */
    select?: GlobalNaturalPersonCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * GlobalNaturalPersonCountOutputType without action
   */
  export type GlobalNaturalPersonCountOutputTypeCountIdentifiersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonIdentifierWhereInput
  }

  /**
   * GlobalNaturalPersonCountOutputType without action
   */
  export type GlobalNaturalPersonCountOutputTypeCountAccessRequestsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonAccessRequestWhereInput
  }

  /**
   * GlobalNaturalPersonCountOutputType without action
   */
  export type GlobalNaturalPersonCountOutputTypeCountAccessGrantsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonAccessGrantWhereInput
  }

  /**
   * GlobalNaturalPersonCountOutputType without action
   */
  export type GlobalNaturalPersonCountOutputTypeCountAccessLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonAccessLogWhereInput
  }

  /**
   * GlobalNaturalPersonCountOutputType without action
   */
  export type GlobalNaturalPersonCountOutputTypeCountAddressesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonAddressWhereInput
  }

  /**
   * GlobalNaturalPersonCountOutputType without action
   */
  export type GlobalNaturalPersonCountOutputTypeCountMergedFromArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GlobalNaturalPersonWhereInput
  }


  /**
   * Models
   */

  /**
   * Model GlobalNaturalPerson
   */

  export type AggregateGlobalNaturalPerson = {
    _count: GlobalNaturalPersonCountAggregateOutputType | null
    _min: GlobalNaturalPersonMinAggregateOutputType | null
    _max: GlobalNaturalPersonMaxAggregateOutputType | null
  }

  export type GlobalNaturalPersonMinAggregateOutputType = {
    id: string | null
    finBlindIndex: string | null
    finCipher: string | null
    firstNameCipher: string | null
    middleNameCipher: string | null
    lastNameCipher: string | null
    fullNameCipher: string | null
    phoneCipher: string | null
    nationality: string | null
    sex: $Enums.PersonSex | null
    birthDate: Date | null
    personSegment: $Enums.PersonSegment | null
    mergedIntoPersonId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GlobalNaturalPersonMaxAggregateOutputType = {
    id: string | null
    finBlindIndex: string | null
    finCipher: string | null
    firstNameCipher: string | null
    middleNameCipher: string | null
    lastNameCipher: string | null
    fullNameCipher: string | null
    phoneCipher: string | null
    nationality: string | null
    sex: $Enums.PersonSex | null
    birthDate: Date | null
    personSegment: $Enums.PersonSegment | null
    mergedIntoPersonId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GlobalNaturalPersonCountAggregateOutputType = {
    id: number
    finBlindIndex: number
    finCipher: number
    firstNameCipher: number
    middleNameCipher: number
    lastNameCipher: number
    fullNameCipher: number
    phoneCipher: number
    nationality: number
    sex: number
    birthDate: number
    personSegment: number
    mergedIntoPersonId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type GlobalNaturalPersonMinAggregateInputType = {
    id?: true
    finBlindIndex?: true
    finCipher?: true
    firstNameCipher?: true
    middleNameCipher?: true
    lastNameCipher?: true
    fullNameCipher?: true
    phoneCipher?: true
    nationality?: true
    sex?: true
    birthDate?: true
    personSegment?: true
    mergedIntoPersonId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GlobalNaturalPersonMaxAggregateInputType = {
    id?: true
    finBlindIndex?: true
    finCipher?: true
    firstNameCipher?: true
    middleNameCipher?: true
    lastNameCipher?: true
    fullNameCipher?: true
    phoneCipher?: true
    nationality?: true
    sex?: true
    birthDate?: true
    personSegment?: true
    mergedIntoPersonId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GlobalNaturalPersonCountAggregateInputType = {
    id?: true
    finBlindIndex?: true
    finCipher?: true
    firstNameCipher?: true
    middleNameCipher?: true
    lastNameCipher?: true
    fullNameCipher?: true
    phoneCipher?: true
    nationality?: true
    sex?: true
    birthDate?: true
    personSegment?: true
    mergedIntoPersonId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type GlobalNaturalPersonAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GlobalNaturalPerson to aggregate.
     */
    where?: GlobalNaturalPersonWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalNaturalPeople to fetch.
     */
    orderBy?: GlobalNaturalPersonOrderByWithRelationInput | GlobalNaturalPersonOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: GlobalNaturalPersonWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalNaturalPeople from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalNaturalPeople.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned GlobalNaturalPeople
    **/
    _count?: true | GlobalNaturalPersonCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GlobalNaturalPersonMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GlobalNaturalPersonMaxAggregateInputType
  }

  export type GetGlobalNaturalPersonAggregateType<T extends GlobalNaturalPersonAggregateArgs> = {
        [P in keyof T & keyof AggregateGlobalNaturalPerson]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGlobalNaturalPerson[P]>
      : GetScalarType<T[P], AggregateGlobalNaturalPerson[P]>
  }




  export type GlobalNaturalPersonGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GlobalNaturalPersonWhereInput
    orderBy?: GlobalNaturalPersonOrderByWithAggregationInput | GlobalNaturalPersonOrderByWithAggregationInput[]
    by: GlobalNaturalPersonScalarFieldEnum[] | GlobalNaturalPersonScalarFieldEnum
    having?: GlobalNaturalPersonScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GlobalNaturalPersonCountAggregateInputType | true
    _min?: GlobalNaturalPersonMinAggregateInputType
    _max?: GlobalNaturalPersonMaxAggregateInputType
  }

  export type GlobalNaturalPersonGroupByOutputType = {
    id: string
    finBlindIndex: string | null
    finCipher: string | null
    firstNameCipher: string | null
    middleNameCipher: string | null
    lastNameCipher: string | null
    fullNameCipher: string | null
    phoneCipher: string | null
    nationality: string | null
    sex: $Enums.PersonSex
    birthDate: Date | null
    personSegment: $Enums.PersonSegment
    mergedIntoPersonId: string | null
    createdAt: Date
    updatedAt: Date
    _count: GlobalNaturalPersonCountAggregateOutputType | null
    _min: GlobalNaturalPersonMinAggregateOutputType | null
    _max: GlobalNaturalPersonMaxAggregateOutputType | null
  }

  type GetGlobalNaturalPersonGroupByPayload<T extends GlobalNaturalPersonGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GlobalNaturalPersonGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GlobalNaturalPersonGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GlobalNaturalPersonGroupByOutputType[P]>
            : GetScalarType<T[P], GlobalNaturalPersonGroupByOutputType[P]>
        }
      >
    >


  export type GlobalNaturalPersonSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    finBlindIndex?: boolean
    finCipher?: boolean
    firstNameCipher?: boolean
    middleNameCipher?: boolean
    lastNameCipher?: boolean
    fullNameCipher?: boolean
    phoneCipher?: boolean
    nationality?: boolean
    sex?: boolean
    birthDate?: boolean
    personSegment?: boolean
    mergedIntoPersonId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    identifiers?: boolean | GlobalNaturalPerson$identifiersArgs<ExtArgs>
    accessRequests?: boolean | GlobalNaturalPerson$accessRequestsArgs<ExtArgs>
    accessGrants?: boolean | GlobalNaturalPerson$accessGrantsArgs<ExtArgs>
    accessLogs?: boolean | GlobalNaturalPerson$accessLogsArgs<ExtArgs>
    hrProfile?: boolean | GlobalNaturalPerson$hrProfileArgs<ExtArgs>
    addresses?: boolean | GlobalNaturalPerson$addressesArgs<ExtArgs>
    mergedInto?: boolean | GlobalNaturalPerson$mergedIntoArgs<ExtArgs>
    mergedFrom?: boolean | GlobalNaturalPerson$mergedFromArgs<ExtArgs>
    _count?: boolean | GlobalNaturalPersonCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["globalNaturalPerson"]>

  export type GlobalNaturalPersonSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    finBlindIndex?: boolean
    finCipher?: boolean
    firstNameCipher?: boolean
    middleNameCipher?: boolean
    lastNameCipher?: boolean
    fullNameCipher?: boolean
    phoneCipher?: boolean
    nationality?: boolean
    sex?: boolean
    birthDate?: boolean
    personSegment?: boolean
    mergedIntoPersonId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    mergedInto?: boolean | GlobalNaturalPerson$mergedIntoArgs<ExtArgs>
  }, ExtArgs["result"]["globalNaturalPerson"]>

  export type GlobalNaturalPersonSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    finBlindIndex?: boolean
    finCipher?: boolean
    firstNameCipher?: boolean
    middleNameCipher?: boolean
    lastNameCipher?: boolean
    fullNameCipher?: boolean
    phoneCipher?: boolean
    nationality?: boolean
    sex?: boolean
    birthDate?: boolean
    personSegment?: boolean
    mergedIntoPersonId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    mergedInto?: boolean | GlobalNaturalPerson$mergedIntoArgs<ExtArgs>
  }, ExtArgs["result"]["globalNaturalPerson"]>

  export type GlobalNaturalPersonSelectScalar = {
    id?: boolean
    finBlindIndex?: boolean
    finCipher?: boolean
    firstNameCipher?: boolean
    middleNameCipher?: boolean
    lastNameCipher?: boolean
    fullNameCipher?: boolean
    phoneCipher?: boolean
    nationality?: boolean
    sex?: boolean
    birthDate?: boolean
    personSegment?: boolean
    mergedIntoPersonId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type GlobalNaturalPersonOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "finBlindIndex" | "finCipher" | "firstNameCipher" | "middleNameCipher" | "lastNameCipher" | "fullNameCipher" | "phoneCipher" | "nationality" | "sex" | "birthDate" | "personSegment" | "mergedIntoPersonId" | "createdAt" | "updatedAt", ExtArgs["result"]["globalNaturalPerson"]>
  export type GlobalNaturalPersonInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    identifiers?: boolean | GlobalNaturalPerson$identifiersArgs<ExtArgs>
    accessRequests?: boolean | GlobalNaturalPerson$accessRequestsArgs<ExtArgs>
    accessGrants?: boolean | GlobalNaturalPerson$accessGrantsArgs<ExtArgs>
    accessLogs?: boolean | GlobalNaturalPerson$accessLogsArgs<ExtArgs>
    hrProfile?: boolean | GlobalNaturalPerson$hrProfileArgs<ExtArgs>
    addresses?: boolean | GlobalNaturalPerson$addressesArgs<ExtArgs>
    mergedInto?: boolean | GlobalNaturalPerson$mergedIntoArgs<ExtArgs>
    mergedFrom?: boolean | GlobalNaturalPerson$mergedFromArgs<ExtArgs>
    _count?: boolean | GlobalNaturalPersonCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type GlobalNaturalPersonIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    mergedInto?: boolean | GlobalNaturalPerson$mergedIntoArgs<ExtArgs>
  }
  export type GlobalNaturalPersonIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    mergedInto?: boolean | GlobalNaturalPerson$mergedIntoArgs<ExtArgs>
  }

  export type $GlobalNaturalPersonPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "GlobalNaturalPerson"
    objects: {
      identifiers: Prisma.$PersonIdentifierPayload<ExtArgs>[]
      accessRequests: Prisma.$PersonAccessRequestPayload<ExtArgs>[]
      accessGrants: Prisma.$PersonAccessGrantPayload<ExtArgs>[]
      accessLogs: Prisma.$PersonAccessLogPayload<ExtArgs>[]
      hrProfile: Prisma.$PersonHrProfilePayload<ExtArgs> | null
      addresses: Prisma.$PersonAddressPayload<ExtArgs>[]
      mergedInto: Prisma.$GlobalNaturalPersonPayload<ExtArgs> | null
      mergedFrom: Prisma.$GlobalNaturalPersonPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      /**
       * Legacy FIN blind index — kept for back-compat; canonical identifiers live in PersonIdentifier.
       */
      finBlindIndex: string | null
      finCipher: string | null
      /**
       * Given name (Ad). SoR for person name parts; fullNameCipher is denormalized.
       */
      firstNameCipher: string | null
      /**
       * Patronymic (Ata adı). Optional.
       */
      middleNameCipher: string | null
      /**
       * Surname (Soyad).
       */
      lastNameCipher: string | null
      /**
       * Denormalized: firstName + middleName + lastName (given + patronymic + surname).
       */
      fullNameCipher: string | null
      phoneCipher: string | null
      /**
       * ISO 3166-1 alpha-2 citizenship (not ethnicity). Do not store OTHER.
       */
      nationality: string | null
      /**
       * SoR for legal sex (not HR profile). Satellites cache; do not invent a second identity card.
       */
      sex: $Enums.PersonSex
      birthDate: Date | null
      personSegment: $Enums.PersonSegment
      mergedIntoPersonId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["globalNaturalPerson"]>
    composites: {}
  }

  type GlobalNaturalPersonGetPayload<S extends boolean | null | undefined | GlobalNaturalPersonDefaultArgs> = $Result.GetResult<Prisma.$GlobalNaturalPersonPayload, S>

  type GlobalNaturalPersonCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<GlobalNaturalPersonFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GlobalNaturalPersonCountAggregateInputType | true
    }

  export interface GlobalNaturalPersonDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['GlobalNaturalPerson'], meta: { name: 'GlobalNaturalPerson' } }
    /**
     * Find zero or one GlobalNaturalPerson that matches the filter.
     * @param {GlobalNaturalPersonFindUniqueArgs} args - Arguments to find a GlobalNaturalPerson
     * @example
     * // Get one GlobalNaturalPerson
     * const globalNaturalPerson = await prisma.globalNaturalPerson.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends GlobalNaturalPersonFindUniqueArgs>(args: SelectSubset<T, GlobalNaturalPersonFindUniqueArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one GlobalNaturalPerson that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {GlobalNaturalPersonFindUniqueOrThrowArgs} args - Arguments to find a GlobalNaturalPerson
     * @example
     * // Get one GlobalNaturalPerson
     * const globalNaturalPerson = await prisma.globalNaturalPerson.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends GlobalNaturalPersonFindUniqueOrThrowArgs>(args: SelectSubset<T, GlobalNaturalPersonFindUniqueOrThrowArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GlobalNaturalPerson that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalNaturalPersonFindFirstArgs} args - Arguments to find a GlobalNaturalPerson
     * @example
     * // Get one GlobalNaturalPerson
     * const globalNaturalPerson = await prisma.globalNaturalPerson.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends GlobalNaturalPersonFindFirstArgs>(args?: SelectSubset<T, GlobalNaturalPersonFindFirstArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GlobalNaturalPerson that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalNaturalPersonFindFirstOrThrowArgs} args - Arguments to find a GlobalNaturalPerson
     * @example
     * // Get one GlobalNaturalPerson
     * const globalNaturalPerson = await prisma.globalNaturalPerson.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends GlobalNaturalPersonFindFirstOrThrowArgs>(args?: SelectSubset<T, GlobalNaturalPersonFindFirstOrThrowArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more GlobalNaturalPeople that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalNaturalPersonFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all GlobalNaturalPeople
     * const globalNaturalPeople = await prisma.globalNaturalPerson.findMany()
     * 
     * // Get first 10 GlobalNaturalPeople
     * const globalNaturalPeople = await prisma.globalNaturalPerson.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const globalNaturalPersonWithIdOnly = await prisma.globalNaturalPerson.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends GlobalNaturalPersonFindManyArgs>(args?: SelectSubset<T, GlobalNaturalPersonFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a GlobalNaturalPerson.
     * @param {GlobalNaturalPersonCreateArgs} args - Arguments to create a GlobalNaturalPerson.
     * @example
     * // Create one GlobalNaturalPerson
     * const GlobalNaturalPerson = await prisma.globalNaturalPerson.create({
     *   data: {
     *     // ... data to create a GlobalNaturalPerson
     *   }
     * })
     * 
     */
    create<T extends GlobalNaturalPersonCreateArgs>(args: SelectSubset<T, GlobalNaturalPersonCreateArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many GlobalNaturalPeople.
     * @param {GlobalNaturalPersonCreateManyArgs} args - Arguments to create many GlobalNaturalPeople.
     * @example
     * // Create many GlobalNaturalPeople
     * const globalNaturalPerson = await prisma.globalNaturalPerson.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends GlobalNaturalPersonCreateManyArgs>(args?: SelectSubset<T, GlobalNaturalPersonCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many GlobalNaturalPeople and returns the data saved in the database.
     * @param {GlobalNaturalPersonCreateManyAndReturnArgs} args - Arguments to create many GlobalNaturalPeople.
     * @example
     * // Create many GlobalNaturalPeople
     * const globalNaturalPerson = await prisma.globalNaturalPerson.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many GlobalNaturalPeople and only return the `id`
     * const globalNaturalPersonWithIdOnly = await prisma.globalNaturalPerson.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends GlobalNaturalPersonCreateManyAndReturnArgs>(args?: SelectSubset<T, GlobalNaturalPersonCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a GlobalNaturalPerson.
     * @param {GlobalNaturalPersonDeleteArgs} args - Arguments to delete one GlobalNaturalPerson.
     * @example
     * // Delete one GlobalNaturalPerson
     * const GlobalNaturalPerson = await prisma.globalNaturalPerson.delete({
     *   where: {
     *     // ... filter to delete one GlobalNaturalPerson
     *   }
     * })
     * 
     */
    delete<T extends GlobalNaturalPersonDeleteArgs>(args: SelectSubset<T, GlobalNaturalPersonDeleteArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one GlobalNaturalPerson.
     * @param {GlobalNaturalPersonUpdateArgs} args - Arguments to update one GlobalNaturalPerson.
     * @example
     * // Update one GlobalNaturalPerson
     * const globalNaturalPerson = await prisma.globalNaturalPerson.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends GlobalNaturalPersonUpdateArgs>(args: SelectSubset<T, GlobalNaturalPersonUpdateArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more GlobalNaturalPeople.
     * @param {GlobalNaturalPersonDeleteManyArgs} args - Arguments to filter GlobalNaturalPeople to delete.
     * @example
     * // Delete a few GlobalNaturalPeople
     * const { count } = await prisma.globalNaturalPerson.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends GlobalNaturalPersonDeleteManyArgs>(args?: SelectSubset<T, GlobalNaturalPersonDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GlobalNaturalPeople.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalNaturalPersonUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many GlobalNaturalPeople
     * const globalNaturalPerson = await prisma.globalNaturalPerson.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends GlobalNaturalPersonUpdateManyArgs>(args: SelectSubset<T, GlobalNaturalPersonUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GlobalNaturalPeople and returns the data updated in the database.
     * @param {GlobalNaturalPersonUpdateManyAndReturnArgs} args - Arguments to update many GlobalNaturalPeople.
     * @example
     * // Update many GlobalNaturalPeople
     * const globalNaturalPerson = await prisma.globalNaturalPerson.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more GlobalNaturalPeople and only return the `id`
     * const globalNaturalPersonWithIdOnly = await prisma.globalNaturalPerson.updateManyAndReturn({
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
    updateManyAndReturn<T extends GlobalNaturalPersonUpdateManyAndReturnArgs>(args: SelectSubset<T, GlobalNaturalPersonUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one GlobalNaturalPerson.
     * @param {GlobalNaturalPersonUpsertArgs} args - Arguments to update or create a GlobalNaturalPerson.
     * @example
     * // Update or create a GlobalNaturalPerson
     * const globalNaturalPerson = await prisma.globalNaturalPerson.upsert({
     *   create: {
     *     // ... data to create a GlobalNaturalPerson
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the GlobalNaturalPerson we want to update
     *   }
     * })
     */
    upsert<T extends GlobalNaturalPersonUpsertArgs>(args: SelectSubset<T, GlobalNaturalPersonUpsertArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of GlobalNaturalPeople.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalNaturalPersonCountArgs} args - Arguments to filter GlobalNaturalPeople to count.
     * @example
     * // Count the number of GlobalNaturalPeople
     * const count = await prisma.globalNaturalPerson.count({
     *   where: {
     *     // ... the filter for the GlobalNaturalPeople we want to count
     *   }
     * })
    **/
    count<T extends GlobalNaturalPersonCountArgs>(
      args?: Subset<T, GlobalNaturalPersonCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GlobalNaturalPersonCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a GlobalNaturalPerson.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalNaturalPersonAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends GlobalNaturalPersonAggregateArgs>(args: Subset<T, GlobalNaturalPersonAggregateArgs>): Prisma.PrismaPromise<GetGlobalNaturalPersonAggregateType<T>>

    /**
     * Group by GlobalNaturalPerson.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalNaturalPersonGroupByArgs} args - Group by arguments.
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
      T extends GlobalNaturalPersonGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: GlobalNaturalPersonGroupByArgs['orderBy'] }
        : { orderBy?: GlobalNaturalPersonGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, GlobalNaturalPersonGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGlobalNaturalPersonGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the GlobalNaturalPerson model
   */
  readonly fields: GlobalNaturalPersonFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for GlobalNaturalPerson.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__GlobalNaturalPersonClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    identifiers<T extends GlobalNaturalPerson$identifiersArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPerson$identifiersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    accessRequests<T extends GlobalNaturalPerson$accessRequestsArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPerson$accessRequestsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    accessGrants<T extends GlobalNaturalPerson$accessGrantsArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPerson$accessGrantsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    accessLogs<T extends GlobalNaturalPerson$accessLogsArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPerson$accessLogsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    hrProfile<T extends GlobalNaturalPerson$hrProfileArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPerson$hrProfileArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    addresses<T extends GlobalNaturalPerson$addressesArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPerson$addressesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    mergedInto<T extends GlobalNaturalPerson$mergedIntoArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPerson$mergedIntoArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    mergedFrom<T extends GlobalNaturalPerson$mergedFromArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPerson$mergedFromArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
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
   * Fields of the GlobalNaturalPerson model
   */
  interface GlobalNaturalPersonFieldRefs {
    readonly id: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly finBlindIndex: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly finCipher: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly firstNameCipher: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly middleNameCipher: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly lastNameCipher: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly fullNameCipher: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly phoneCipher: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly nationality: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly sex: FieldRef<"GlobalNaturalPerson", 'PersonSex'>
    readonly birthDate: FieldRef<"GlobalNaturalPerson", 'DateTime'>
    readonly personSegment: FieldRef<"GlobalNaturalPerson", 'PersonSegment'>
    readonly mergedIntoPersonId: FieldRef<"GlobalNaturalPerson", 'String'>
    readonly createdAt: FieldRef<"GlobalNaturalPerson", 'DateTime'>
    readonly updatedAt: FieldRef<"GlobalNaturalPerson", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * GlobalNaturalPerson findUnique
   */
  export type GlobalNaturalPersonFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * Filter, which GlobalNaturalPerson to fetch.
     */
    where: GlobalNaturalPersonWhereUniqueInput
  }

  /**
   * GlobalNaturalPerson findUniqueOrThrow
   */
  export type GlobalNaturalPersonFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * Filter, which GlobalNaturalPerson to fetch.
     */
    where: GlobalNaturalPersonWhereUniqueInput
  }

  /**
   * GlobalNaturalPerson findFirst
   */
  export type GlobalNaturalPersonFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * Filter, which GlobalNaturalPerson to fetch.
     */
    where?: GlobalNaturalPersonWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalNaturalPeople to fetch.
     */
    orderBy?: GlobalNaturalPersonOrderByWithRelationInput | GlobalNaturalPersonOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GlobalNaturalPeople.
     */
    cursor?: GlobalNaturalPersonWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalNaturalPeople from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalNaturalPeople.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalNaturalPeople.
     */
    distinct?: GlobalNaturalPersonScalarFieldEnum | GlobalNaturalPersonScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson findFirstOrThrow
   */
  export type GlobalNaturalPersonFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * Filter, which GlobalNaturalPerson to fetch.
     */
    where?: GlobalNaturalPersonWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalNaturalPeople to fetch.
     */
    orderBy?: GlobalNaturalPersonOrderByWithRelationInput | GlobalNaturalPersonOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GlobalNaturalPeople.
     */
    cursor?: GlobalNaturalPersonWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalNaturalPeople from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalNaturalPeople.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalNaturalPeople.
     */
    distinct?: GlobalNaturalPersonScalarFieldEnum | GlobalNaturalPersonScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson findMany
   */
  export type GlobalNaturalPersonFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * Filter, which GlobalNaturalPeople to fetch.
     */
    where?: GlobalNaturalPersonWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalNaturalPeople to fetch.
     */
    orderBy?: GlobalNaturalPersonOrderByWithRelationInput | GlobalNaturalPersonOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing GlobalNaturalPeople.
     */
    cursor?: GlobalNaturalPersonWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalNaturalPeople from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalNaturalPeople.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalNaturalPeople.
     */
    distinct?: GlobalNaturalPersonScalarFieldEnum | GlobalNaturalPersonScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson create
   */
  export type GlobalNaturalPersonCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * The data needed to create a GlobalNaturalPerson.
     */
    data: XOR<GlobalNaturalPersonCreateInput, GlobalNaturalPersonUncheckedCreateInput>
  }

  /**
   * GlobalNaturalPerson createMany
   */
  export type GlobalNaturalPersonCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many GlobalNaturalPeople.
     */
    data: GlobalNaturalPersonCreateManyInput | GlobalNaturalPersonCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GlobalNaturalPerson createManyAndReturn
   */
  export type GlobalNaturalPersonCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * The data used to create many GlobalNaturalPeople.
     */
    data: GlobalNaturalPersonCreateManyInput | GlobalNaturalPersonCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * GlobalNaturalPerson update
   */
  export type GlobalNaturalPersonUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * The data needed to update a GlobalNaturalPerson.
     */
    data: XOR<GlobalNaturalPersonUpdateInput, GlobalNaturalPersonUncheckedUpdateInput>
    /**
     * Choose, which GlobalNaturalPerson to update.
     */
    where: GlobalNaturalPersonWhereUniqueInput
  }

  /**
   * GlobalNaturalPerson updateMany
   */
  export type GlobalNaturalPersonUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update GlobalNaturalPeople.
     */
    data: XOR<GlobalNaturalPersonUpdateManyMutationInput, GlobalNaturalPersonUncheckedUpdateManyInput>
    /**
     * Filter which GlobalNaturalPeople to update
     */
    where?: GlobalNaturalPersonWhereInput
    /**
     * Limit how many GlobalNaturalPeople to update.
     */
    limit?: number
  }

  /**
   * GlobalNaturalPerson updateManyAndReturn
   */
  export type GlobalNaturalPersonUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * The data used to update GlobalNaturalPeople.
     */
    data: XOR<GlobalNaturalPersonUpdateManyMutationInput, GlobalNaturalPersonUncheckedUpdateManyInput>
    /**
     * Filter which GlobalNaturalPeople to update
     */
    where?: GlobalNaturalPersonWhereInput
    /**
     * Limit how many GlobalNaturalPeople to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * GlobalNaturalPerson upsert
   */
  export type GlobalNaturalPersonUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * The filter to search for the GlobalNaturalPerson to update in case it exists.
     */
    where: GlobalNaturalPersonWhereUniqueInput
    /**
     * In case the GlobalNaturalPerson found by the `where` argument doesn't exist, create a new GlobalNaturalPerson with this data.
     */
    create: XOR<GlobalNaturalPersonCreateInput, GlobalNaturalPersonUncheckedCreateInput>
    /**
     * In case the GlobalNaturalPerson was found with the provided `where` argument, update it with this data.
     */
    update: XOR<GlobalNaturalPersonUpdateInput, GlobalNaturalPersonUncheckedUpdateInput>
  }

  /**
   * GlobalNaturalPerson delete
   */
  export type GlobalNaturalPersonDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    /**
     * Filter which GlobalNaturalPerson to delete.
     */
    where: GlobalNaturalPersonWhereUniqueInput
  }

  /**
   * GlobalNaturalPerson deleteMany
   */
  export type GlobalNaturalPersonDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GlobalNaturalPeople to delete
     */
    where?: GlobalNaturalPersonWhereInput
    /**
     * Limit how many GlobalNaturalPeople to delete.
     */
    limit?: number
  }

  /**
   * GlobalNaturalPerson.identifiers
   */
  export type GlobalNaturalPerson$identifiersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    where?: PersonIdentifierWhereInput
    orderBy?: PersonIdentifierOrderByWithRelationInput | PersonIdentifierOrderByWithRelationInput[]
    cursor?: PersonIdentifierWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PersonIdentifierScalarFieldEnum | PersonIdentifierScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson.accessRequests
   */
  export type GlobalNaturalPerson$accessRequestsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    where?: PersonAccessRequestWhereInput
    orderBy?: PersonAccessRequestOrderByWithRelationInput | PersonAccessRequestOrderByWithRelationInput[]
    cursor?: PersonAccessRequestWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PersonAccessRequestScalarFieldEnum | PersonAccessRequestScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson.accessGrants
   */
  export type GlobalNaturalPerson$accessGrantsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    where?: PersonAccessGrantWhereInput
    orderBy?: PersonAccessGrantOrderByWithRelationInput | PersonAccessGrantOrderByWithRelationInput[]
    cursor?: PersonAccessGrantWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PersonAccessGrantScalarFieldEnum | PersonAccessGrantScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson.accessLogs
   */
  export type GlobalNaturalPerson$accessLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    where?: PersonAccessLogWhereInput
    orderBy?: PersonAccessLogOrderByWithRelationInput | PersonAccessLogOrderByWithRelationInput[]
    cursor?: PersonAccessLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PersonAccessLogScalarFieldEnum | PersonAccessLogScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson.hrProfile
   */
  export type GlobalNaturalPerson$hrProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    where?: PersonHrProfileWhereInput
  }

  /**
   * GlobalNaturalPerson.addresses
   */
  export type GlobalNaturalPerson$addressesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    where?: PersonAddressWhereInput
    orderBy?: PersonAddressOrderByWithRelationInput | PersonAddressOrderByWithRelationInput[]
    cursor?: PersonAddressWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PersonAddressScalarFieldEnum | PersonAddressScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson.mergedInto
   */
  export type GlobalNaturalPerson$mergedIntoArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    where?: GlobalNaturalPersonWhereInput
  }

  /**
   * GlobalNaturalPerson.mergedFrom
   */
  export type GlobalNaturalPerson$mergedFromArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
    where?: GlobalNaturalPersonWhereInput
    orderBy?: GlobalNaturalPersonOrderByWithRelationInput | GlobalNaturalPersonOrderByWithRelationInput[]
    cursor?: GlobalNaturalPersonWhereUniqueInput
    take?: number
    skip?: number
    distinct?: GlobalNaturalPersonScalarFieldEnum | GlobalNaturalPersonScalarFieldEnum[]
  }

  /**
   * GlobalNaturalPerson without action
   */
  export type GlobalNaturalPersonDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalNaturalPerson
     */
    select?: GlobalNaturalPersonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalNaturalPerson
     */
    omit?: GlobalNaturalPersonOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GlobalNaturalPersonInclude<ExtArgs> | null
  }


  /**
   * Model PersonHrProfile
   */

  export type AggregatePersonHrProfile = {
    _count: PersonHrProfileCountAggregateOutputType | null
    _min: PersonHrProfileMinAggregateOutputType | null
    _max: PersonHrProfileMaxAggregateOutputType | null
  }

  export type PersonHrProfileMinAggregateOutputType = {
    id: string | null
    personId: string | null
    bloodGroup: $Enums.BloodGroup | null
    maritalStatus: $Enums.MaritalStatus | null
    educationCipher: string | null
    specialtyCipher: string | null
    photoStorageKey: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PersonHrProfileMaxAggregateOutputType = {
    id: string | null
    personId: string | null
    bloodGroup: $Enums.BloodGroup | null
    maritalStatus: $Enums.MaritalStatus | null
    educationCipher: string | null
    specialtyCipher: string | null
    photoStorageKey: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PersonHrProfileCountAggregateOutputType = {
    id: number
    personId: number
    bloodGroup: number
    maritalStatus: number
    educationCipher: number
    specialtyCipher: number
    statisticalCategories: number
    photoStorageKey: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PersonHrProfileMinAggregateInputType = {
    id?: true
    personId?: true
    bloodGroup?: true
    maritalStatus?: true
    educationCipher?: true
    specialtyCipher?: true
    photoStorageKey?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PersonHrProfileMaxAggregateInputType = {
    id?: true
    personId?: true
    bloodGroup?: true
    maritalStatus?: true
    educationCipher?: true
    specialtyCipher?: true
    photoStorageKey?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PersonHrProfileCountAggregateInputType = {
    id?: true
    personId?: true
    bloodGroup?: true
    maritalStatus?: true
    educationCipher?: true
    specialtyCipher?: true
    statisticalCategories?: true
    photoStorageKey?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PersonHrProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonHrProfile to aggregate.
     */
    where?: PersonHrProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonHrProfiles to fetch.
     */
    orderBy?: PersonHrProfileOrderByWithRelationInput | PersonHrProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonHrProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonHrProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonHrProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PersonHrProfiles
    **/
    _count?: true | PersonHrProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonHrProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonHrProfileMaxAggregateInputType
  }

  export type GetPersonHrProfileAggregateType<T extends PersonHrProfileAggregateArgs> = {
        [P in keyof T & keyof AggregatePersonHrProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersonHrProfile[P]>
      : GetScalarType<T[P], AggregatePersonHrProfile[P]>
  }




  export type PersonHrProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonHrProfileWhereInput
    orderBy?: PersonHrProfileOrderByWithAggregationInput | PersonHrProfileOrderByWithAggregationInput[]
    by: PersonHrProfileScalarFieldEnum[] | PersonHrProfileScalarFieldEnum
    having?: PersonHrProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonHrProfileCountAggregateInputType | true
    _min?: PersonHrProfileMinAggregateInputType
    _max?: PersonHrProfileMaxAggregateInputType
  }

  export type PersonHrProfileGroupByOutputType = {
    id: string
    personId: string
    bloodGroup: $Enums.BloodGroup
    maritalStatus: $Enums.MaritalStatus | null
    educationCipher: string | null
    specialtyCipher: string | null
    statisticalCategories: $Enums.StatisticalCategory[]
    photoStorageKey: string | null
    createdAt: Date
    updatedAt: Date
    _count: PersonHrProfileCountAggregateOutputType | null
    _min: PersonHrProfileMinAggregateOutputType | null
    _max: PersonHrProfileMaxAggregateOutputType | null
  }

  type GetPersonHrProfileGroupByPayload<T extends PersonHrProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonHrProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonHrProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonHrProfileGroupByOutputType[P]>
            : GetScalarType<T[P], PersonHrProfileGroupByOutputType[P]>
        }
      >
    >


  export type PersonHrProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    bloodGroup?: boolean
    maritalStatus?: boolean
    educationCipher?: boolean
    specialtyCipher?: boolean
    statisticalCategories?: boolean
    photoStorageKey?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personHrProfile"]>

  export type PersonHrProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    bloodGroup?: boolean
    maritalStatus?: boolean
    educationCipher?: boolean
    specialtyCipher?: boolean
    statisticalCategories?: boolean
    photoStorageKey?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personHrProfile"]>

  export type PersonHrProfileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    bloodGroup?: boolean
    maritalStatus?: boolean
    educationCipher?: boolean
    specialtyCipher?: boolean
    statisticalCategories?: boolean
    photoStorageKey?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personHrProfile"]>

  export type PersonHrProfileSelectScalar = {
    id?: boolean
    personId?: boolean
    bloodGroup?: boolean
    maritalStatus?: boolean
    educationCipher?: boolean
    specialtyCipher?: boolean
    statisticalCategories?: boolean
    photoStorageKey?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PersonHrProfileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "personId" | "bloodGroup" | "maritalStatus" | "educationCipher" | "specialtyCipher" | "statisticalCategories" | "photoStorageKey" | "createdAt" | "updatedAt", ExtArgs["result"]["personHrProfile"]>
  export type PersonHrProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonHrProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonHrProfileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }

  export type $PersonHrProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PersonHrProfile"
    objects: {
      person: Prisma.$GlobalNaturalPersonPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      personId: string
      bloodGroup: $Enums.BloodGroup
      maritalStatus: $Enums.MaritalStatus | null
      educationCipher: string | null
      specialtyCipher: string | null
      statisticalCategories: $Enums.StatisticalCategory[]
      photoStorageKey: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["personHrProfile"]>
    composites: {}
  }

  type PersonHrProfileGetPayload<S extends boolean | null | undefined | PersonHrProfileDefaultArgs> = $Result.GetResult<Prisma.$PersonHrProfilePayload, S>

  type PersonHrProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonHrProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonHrProfileCountAggregateInputType | true
    }

  export interface PersonHrProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PersonHrProfile'], meta: { name: 'PersonHrProfile' } }
    /**
     * Find zero or one PersonHrProfile that matches the filter.
     * @param {PersonHrProfileFindUniqueArgs} args - Arguments to find a PersonHrProfile
     * @example
     * // Get one PersonHrProfile
     * const personHrProfile = await prisma.personHrProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonHrProfileFindUniqueArgs>(args: SelectSubset<T, PersonHrProfileFindUniqueArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PersonHrProfile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonHrProfileFindUniqueOrThrowArgs} args - Arguments to find a PersonHrProfile
     * @example
     * // Get one PersonHrProfile
     * const personHrProfile = await prisma.personHrProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonHrProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonHrProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonHrProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonHrProfileFindFirstArgs} args - Arguments to find a PersonHrProfile
     * @example
     * // Get one PersonHrProfile
     * const personHrProfile = await prisma.personHrProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonHrProfileFindFirstArgs>(args?: SelectSubset<T, PersonHrProfileFindFirstArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonHrProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonHrProfileFindFirstOrThrowArgs} args - Arguments to find a PersonHrProfile
     * @example
     * // Get one PersonHrProfile
     * const personHrProfile = await prisma.personHrProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonHrProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonHrProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PersonHrProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonHrProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PersonHrProfiles
     * const personHrProfiles = await prisma.personHrProfile.findMany()
     * 
     * // Get first 10 PersonHrProfiles
     * const personHrProfiles = await prisma.personHrProfile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personHrProfileWithIdOnly = await prisma.personHrProfile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonHrProfileFindManyArgs>(args?: SelectSubset<T, PersonHrProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PersonHrProfile.
     * @param {PersonHrProfileCreateArgs} args - Arguments to create a PersonHrProfile.
     * @example
     * // Create one PersonHrProfile
     * const PersonHrProfile = await prisma.personHrProfile.create({
     *   data: {
     *     // ... data to create a PersonHrProfile
     *   }
     * })
     * 
     */
    create<T extends PersonHrProfileCreateArgs>(args: SelectSubset<T, PersonHrProfileCreateArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PersonHrProfiles.
     * @param {PersonHrProfileCreateManyArgs} args - Arguments to create many PersonHrProfiles.
     * @example
     * // Create many PersonHrProfiles
     * const personHrProfile = await prisma.personHrProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonHrProfileCreateManyArgs>(args?: SelectSubset<T, PersonHrProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PersonHrProfiles and returns the data saved in the database.
     * @param {PersonHrProfileCreateManyAndReturnArgs} args - Arguments to create many PersonHrProfiles.
     * @example
     * // Create many PersonHrProfiles
     * const personHrProfile = await prisma.personHrProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PersonHrProfiles and only return the `id`
     * const personHrProfileWithIdOnly = await prisma.personHrProfile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonHrProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonHrProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PersonHrProfile.
     * @param {PersonHrProfileDeleteArgs} args - Arguments to delete one PersonHrProfile.
     * @example
     * // Delete one PersonHrProfile
     * const PersonHrProfile = await prisma.personHrProfile.delete({
     *   where: {
     *     // ... filter to delete one PersonHrProfile
     *   }
     * })
     * 
     */
    delete<T extends PersonHrProfileDeleteArgs>(args: SelectSubset<T, PersonHrProfileDeleteArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PersonHrProfile.
     * @param {PersonHrProfileUpdateArgs} args - Arguments to update one PersonHrProfile.
     * @example
     * // Update one PersonHrProfile
     * const personHrProfile = await prisma.personHrProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonHrProfileUpdateArgs>(args: SelectSubset<T, PersonHrProfileUpdateArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PersonHrProfiles.
     * @param {PersonHrProfileDeleteManyArgs} args - Arguments to filter PersonHrProfiles to delete.
     * @example
     * // Delete a few PersonHrProfiles
     * const { count } = await prisma.personHrProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonHrProfileDeleteManyArgs>(args?: SelectSubset<T, PersonHrProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonHrProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonHrProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PersonHrProfiles
     * const personHrProfile = await prisma.personHrProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonHrProfileUpdateManyArgs>(args: SelectSubset<T, PersonHrProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonHrProfiles and returns the data updated in the database.
     * @param {PersonHrProfileUpdateManyAndReturnArgs} args - Arguments to update many PersonHrProfiles.
     * @example
     * // Update many PersonHrProfiles
     * const personHrProfile = await prisma.personHrProfile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PersonHrProfiles and only return the `id`
     * const personHrProfileWithIdOnly = await prisma.personHrProfile.updateManyAndReturn({
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
    updateManyAndReturn<T extends PersonHrProfileUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonHrProfileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PersonHrProfile.
     * @param {PersonHrProfileUpsertArgs} args - Arguments to update or create a PersonHrProfile.
     * @example
     * // Update or create a PersonHrProfile
     * const personHrProfile = await prisma.personHrProfile.upsert({
     *   create: {
     *     // ... data to create a PersonHrProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PersonHrProfile we want to update
     *   }
     * })
     */
    upsert<T extends PersonHrProfileUpsertArgs>(args: SelectSubset<T, PersonHrProfileUpsertArgs<ExtArgs>>): Prisma__PersonHrProfileClient<$Result.GetResult<Prisma.$PersonHrProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PersonHrProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonHrProfileCountArgs} args - Arguments to filter PersonHrProfiles to count.
     * @example
     * // Count the number of PersonHrProfiles
     * const count = await prisma.personHrProfile.count({
     *   where: {
     *     // ... the filter for the PersonHrProfiles we want to count
     *   }
     * })
    **/
    count<T extends PersonHrProfileCountArgs>(
      args?: Subset<T, PersonHrProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonHrProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PersonHrProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonHrProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PersonHrProfileAggregateArgs>(args: Subset<T, PersonHrProfileAggregateArgs>): Prisma.PrismaPromise<GetPersonHrProfileAggregateType<T>>

    /**
     * Group by PersonHrProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonHrProfileGroupByArgs} args - Group by arguments.
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
      T extends PersonHrProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonHrProfileGroupByArgs['orderBy'] }
        : { orderBy?: PersonHrProfileGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, PersonHrProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonHrProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PersonHrProfile model
   */
  readonly fields: PersonHrProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PersonHrProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonHrProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    person<T extends GlobalNaturalPersonDefaultArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPersonDefaultArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
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
   * Fields of the PersonHrProfile model
   */
  interface PersonHrProfileFieldRefs {
    readonly id: FieldRef<"PersonHrProfile", 'String'>
    readonly personId: FieldRef<"PersonHrProfile", 'String'>
    readonly bloodGroup: FieldRef<"PersonHrProfile", 'BloodGroup'>
    readonly maritalStatus: FieldRef<"PersonHrProfile", 'MaritalStatus'>
    readonly educationCipher: FieldRef<"PersonHrProfile", 'String'>
    readonly specialtyCipher: FieldRef<"PersonHrProfile", 'String'>
    readonly statisticalCategories: FieldRef<"PersonHrProfile", 'StatisticalCategory[]'>
    readonly photoStorageKey: FieldRef<"PersonHrProfile", 'String'>
    readonly createdAt: FieldRef<"PersonHrProfile", 'DateTime'>
    readonly updatedAt: FieldRef<"PersonHrProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PersonHrProfile findUnique
   */
  export type PersonHrProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * Filter, which PersonHrProfile to fetch.
     */
    where: PersonHrProfileWhereUniqueInput
  }

  /**
   * PersonHrProfile findUniqueOrThrow
   */
  export type PersonHrProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * Filter, which PersonHrProfile to fetch.
     */
    where: PersonHrProfileWhereUniqueInput
  }

  /**
   * PersonHrProfile findFirst
   */
  export type PersonHrProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * Filter, which PersonHrProfile to fetch.
     */
    where?: PersonHrProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonHrProfiles to fetch.
     */
    orderBy?: PersonHrProfileOrderByWithRelationInput | PersonHrProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonHrProfiles.
     */
    cursor?: PersonHrProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonHrProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonHrProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonHrProfiles.
     */
    distinct?: PersonHrProfileScalarFieldEnum | PersonHrProfileScalarFieldEnum[]
  }

  /**
   * PersonHrProfile findFirstOrThrow
   */
  export type PersonHrProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * Filter, which PersonHrProfile to fetch.
     */
    where?: PersonHrProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonHrProfiles to fetch.
     */
    orderBy?: PersonHrProfileOrderByWithRelationInput | PersonHrProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonHrProfiles.
     */
    cursor?: PersonHrProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonHrProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonHrProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonHrProfiles.
     */
    distinct?: PersonHrProfileScalarFieldEnum | PersonHrProfileScalarFieldEnum[]
  }

  /**
   * PersonHrProfile findMany
   */
  export type PersonHrProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * Filter, which PersonHrProfiles to fetch.
     */
    where?: PersonHrProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonHrProfiles to fetch.
     */
    orderBy?: PersonHrProfileOrderByWithRelationInput | PersonHrProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PersonHrProfiles.
     */
    cursor?: PersonHrProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonHrProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonHrProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonHrProfiles.
     */
    distinct?: PersonHrProfileScalarFieldEnum | PersonHrProfileScalarFieldEnum[]
  }

  /**
   * PersonHrProfile create
   */
  export type PersonHrProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a PersonHrProfile.
     */
    data: XOR<PersonHrProfileCreateInput, PersonHrProfileUncheckedCreateInput>
  }

  /**
   * PersonHrProfile createMany
   */
  export type PersonHrProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PersonHrProfiles.
     */
    data: PersonHrProfileCreateManyInput | PersonHrProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PersonHrProfile createManyAndReturn
   */
  export type PersonHrProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * The data used to create many PersonHrProfiles.
     */
    data: PersonHrProfileCreateManyInput | PersonHrProfileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonHrProfile update
   */
  export type PersonHrProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a PersonHrProfile.
     */
    data: XOR<PersonHrProfileUpdateInput, PersonHrProfileUncheckedUpdateInput>
    /**
     * Choose, which PersonHrProfile to update.
     */
    where: PersonHrProfileWhereUniqueInput
  }

  /**
   * PersonHrProfile updateMany
   */
  export type PersonHrProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PersonHrProfiles.
     */
    data: XOR<PersonHrProfileUpdateManyMutationInput, PersonHrProfileUncheckedUpdateManyInput>
    /**
     * Filter which PersonHrProfiles to update
     */
    where?: PersonHrProfileWhereInput
    /**
     * Limit how many PersonHrProfiles to update.
     */
    limit?: number
  }

  /**
   * PersonHrProfile updateManyAndReturn
   */
  export type PersonHrProfileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * The data used to update PersonHrProfiles.
     */
    data: XOR<PersonHrProfileUpdateManyMutationInput, PersonHrProfileUncheckedUpdateManyInput>
    /**
     * Filter which PersonHrProfiles to update
     */
    where?: PersonHrProfileWhereInput
    /**
     * Limit how many PersonHrProfiles to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonHrProfile upsert
   */
  export type PersonHrProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the PersonHrProfile to update in case it exists.
     */
    where: PersonHrProfileWhereUniqueInput
    /**
     * In case the PersonHrProfile found by the `where` argument doesn't exist, create a new PersonHrProfile with this data.
     */
    create: XOR<PersonHrProfileCreateInput, PersonHrProfileUncheckedCreateInput>
    /**
     * In case the PersonHrProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonHrProfileUpdateInput, PersonHrProfileUncheckedUpdateInput>
  }

  /**
   * PersonHrProfile delete
   */
  export type PersonHrProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
    /**
     * Filter which PersonHrProfile to delete.
     */
    where: PersonHrProfileWhereUniqueInput
  }

  /**
   * PersonHrProfile deleteMany
   */
  export type PersonHrProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonHrProfiles to delete
     */
    where?: PersonHrProfileWhereInput
    /**
     * Limit how many PersonHrProfiles to delete.
     */
    limit?: number
  }

  /**
   * PersonHrProfile without action
   */
  export type PersonHrProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonHrProfile
     */
    select?: PersonHrProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonHrProfile
     */
    omit?: PersonHrProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonHrProfileInclude<ExtArgs> | null
  }


  /**
   * Model PersonAddress
   */

  export type AggregatePersonAddress = {
    _count: PersonAddressCountAggregateOutputType | null
    _min: PersonAddressMinAggregateOutputType | null
    _max: PersonAddressMaxAggregateOutputType | null
  }

  export type PersonAddressMinAggregateOutputType = {
    id: string | null
    personId: string | null
    kind: $Enums.PersonAddressKind | null
    lineCipher: string | null
    cityCipher: string | null
    regionCipher: string | null
    postalCipher: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PersonAddressMaxAggregateOutputType = {
    id: string | null
    personId: string | null
    kind: $Enums.PersonAddressKind | null
    lineCipher: string | null
    cityCipher: string | null
    regionCipher: string | null
    postalCipher: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PersonAddressCountAggregateOutputType = {
    id: number
    personId: number
    kind: number
    lineCipher: number
    cityCipher: number
    regionCipher: number
    postalCipher: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PersonAddressMinAggregateInputType = {
    id?: true
    personId?: true
    kind?: true
    lineCipher?: true
    cityCipher?: true
    regionCipher?: true
    postalCipher?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PersonAddressMaxAggregateInputType = {
    id?: true
    personId?: true
    kind?: true
    lineCipher?: true
    cityCipher?: true
    regionCipher?: true
    postalCipher?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PersonAddressCountAggregateInputType = {
    id?: true
    personId?: true
    kind?: true
    lineCipher?: true
    cityCipher?: true
    regionCipher?: true
    postalCipher?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PersonAddressAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonAddress to aggregate.
     */
    where?: PersonAddressWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAddresses to fetch.
     */
    orderBy?: PersonAddressOrderByWithRelationInput | PersonAddressOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonAddressWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAddresses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAddresses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PersonAddresses
    **/
    _count?: true | PersonAddressCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonAddressMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonAddressMaxAggregateInputType
  }

  export type GetPersonAddressAggregateType<T extends PersonAddressAggregateArgs> = {
        [P in keyof T & keyof AggregatePersonAddress]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersonAddress[P]>
      : GetScalarType<T[P], AggregatePersonAddress[P]>
  }




  export type PersonAddressGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonAddressWhereInput
    orderBy?: PersonAddressOrderByWithAggregationInput | PersonAddressOrderByWithAggregationInput[]
    by: PersonAddressScalarFieldEnum[] | PersonAddressScalarFieldEnum
    having?: PersonAddressScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonAddressCountAggregateInputType | true
    _min?: PersonAddressMinAggregateInputType
    _max?: PersonAddressMaxAggregateInputType
  }

  export type PersonAddressGroupByOutputType = {
    id: string
    personId: string
    kind: $Enums.PersonAddressKind
    lineCipher: string
    cityCipher: string | null
    regionCipher: string | null
    postalCipher: string | null
    createdAt: Date
    updatedAt: Date
    _count: PersonAddressCountAggregateOutputType | null
    _min: PersonAddressMinAggregateOutputType | null
    _max: PersonAddressMaxAggregateOutputType | null
  }

  type GetPersonAddressGroupByPayload<T extends PersonAddressGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonAddressGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonAddressGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonAddressGroupByOutputType[P]>
            : GetScalarType<T[P], PersonAddressGroupByOutputType[P]>
        }
      >
    >


  export type PersonAddressSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    kind?: boolean
    lineCipher?: boolean
    cityCipher?: boolean
    regionCipher?: boolean
    postalCipher?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAddress"]>

  export type PersonAddressSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    kind?: boolean
    lineCipher?: boolean
    cityCipher?: boolean
    regionCipher?: boolean
    postalCipher?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAddress"]>

  export type PersonAddressSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    kind?: boolean
    lineCipher?: boolean
    cityCipher?: boolean
    regionCipher?: boolean
    postalCipher?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAddress"]>

  export type PersonAddressSelectScalar = {
    id?: boolean
    personId?: boolean
    kind?: boolean
    lineCipher?: boolean
    cityCipher?: boolean
    regionCipher?: boolean
    postalCipher?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PersonAddressOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "personId" | "kind" | "lineCipher" | "cityCipher" | "regionCipher" | "postalCipher" | "createdAt" | "updatedAt", ExtArgs["result"]["personAddress"]>
  export type PersonAddressInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonAddressIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonAddressIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }

  export type $PersonAddressPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PersonAddress"
    objects: {
      person: Prisma.$GlobalNaturalPersonPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      personId: string
      kind: $Enums.PersonAddressKind
      lineCipher: string
      cityCipher: string | null
      regionCipher: string | null
      postalCipher: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["personAddress"]>
    composites: {}
  }

  type PersonAddressGetPayload<S extends boolean | null | undefined | PersonAddressDefaultArgs> = $Result.GetResult<Prisma.$PersonAddressPayload, S>

  type PersonAddressCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonAddressFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonAddressCountAggregateInputType | true
    }

  export interface PersonAddressDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PersonAddress'], meta: { name: 'PersonAddress' } }
    /**
     * Find zero or one PersonAddress that matches the filter.
     * @param {PersonAddressFindUniqueArgs} args - Arguments to find a PersonAddress
     * @example
     * // Get one PersonAddress
     * const personAddress = await prisma.personAddress.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonAddressFindUniqueArgs>(args: SelectSubset<T, PersonAddressFindUniqueArgs<ExtArgs>>): Prisma__PersonAddressClient<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PersonAddress that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonAddressFindUniqueOrThrowArgs} args - Arguments to find a PersonAddress
     * @example
     * // Get one PersonAddress
     * const personAddress = await prisma.personAddress.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonAddressFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonAddressFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonAddressClient<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonAddress that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAddressFindFirstArgs} args - Arguments to find a PersonAddress
     * @example
     * // Get one PersonAddress
     * const personAddress = await prisma.personAddress.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonAddressFindFirstArgs>(args?: SelectSubset<T, PersonAddressFindFirstArgs<ExtArgs>>): Prisma__PersonAddressClient<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonAddress that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAddressFindFirstOrThrowArgs} args - Arguments to find a PersonAddress
     * @example
     * // Get one PersonAddress
     * const personAddress = await prisma.personAddress.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonAddressFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonAddressFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonAddressClient<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PersonAddresses that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAddressFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PersonAddresses
     * const personAddresses = await prisma.personAddress.findMany()
     * 
     * // Get first 10 PersonAddresses
     * const personAddresses = await prisma.personAddress.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personAddressWithIdOnly = await prisma.personAddress.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonAddressFindManyArgs>(args?: SelectSubset<T, PersonAddressFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PersonAddress.
     * @param {PersonAddressCreateArgs} args - Arguments to create a PersonAddress.
     * @example
     * // Create one PersonAddress
     * const PersonAddress = await prisma.personAddress.create({
     *   data: {
     *     // ... data to create a PersonAddress
     *   }
     * })
     * 
     */
    create<T extends PersonAddressCreateArgs>(args: SelectSubset<T, PersonAddressCreateArgs<ExtArgs>>): Prisma__PersonAddressClient<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PersonAddresses.
     * @param {PersonAddressCreateManyArgs} args - Arguments to create many PersonAddresses.
     * @example
     * // Create many PersonAddresses
     * const personAddress = await prisma.personAddress.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonAddressCreateManyArgs>(args?: SelectSubset<T, PersonAddressCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PersonAddresses and returns the data saved in the database.
     * @param {PersonAddressCreateManyAndReturnArgs} args - Arguments to create many PersonAddresses.
     * @example
     * // Create many PersonAddresses
     * const personAddress = await prisma.personAddress.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PersonAddresses and only return the `id`
     * const personAddressWithIdOnly = await prisma.personAddress.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonAddressCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonAddressCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PersonAddress.
     * @param {PersonAddressDeleteArgs} args - Arguments to delete one PersonAddress.
     * @example
     * // Delete one PersonAddress
     * const PersonAddress = await prisma.personAddress.delete({
     *   where: {
     *     // ... filter to delete one PersonAddress
     *   }
     * })
     * 
     */
    delete<T extends PersonAddressDeleteArgs>(args: SelectSubset<T, PersonAddressDeleteArgs<ExtArgs>>): Prisma__PersonAddressClient<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PersonAddress.
     * @param {PersonAddressUpdateArgs} args - Arguments to update one PersonAddress.
     * @example
     * // Update one PersonAddress
     * const personAddress = await prisma.personAddress.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonAddressUpdateArgs>(args: SelectSubset<T, PersonAddressUpdateArgs<ExtArgs>>): Prisma__PersonAddressClient<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PersonAddresses.
     * @param {PersonAddressDeleteManyArgs} args - Arguments to filter PersonAddresses to delete.
     * @example
     * // Delete a few PersonAddresses
     * const { count } = await prisma.personAddress.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonAddressDeleteManyArgs>(args?: SelectSubset<T, PersonAddressDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonAddresses.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAddressUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PersonAddresses
     * const personAddress = await prisma.personAddress.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonAddressUpdateManyArgs>(args: SelectSubset<T, PersonAddressUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonAddresses and returns the data updated in the database.
     * @param {PersonAddressUpdateManyAndReturnArgs} args - Arguments to update many PersonAddresses.
     * @example
     * // Update many PersonAddresses
     * const personAddress = await prisma.personAddress.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PersonAddresses and only return the `id`
     * const personAddressWithIdOnly = await prisma.personAddress.updateManyAndReturn({
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
    updateManyAndReturn<T extends PersonAddressUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonAddressUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PersonAddress.
     * @param {PersonAddressUpsertArgs} args - Arguments to update or create a PersonAddress.
     * @example
     * // Update or create a PersonAddress
     * const personAddress = await prisma.personAddress.upsert({
     *   create: {
     *     // ... data to create a PersonAddress
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PersonAddress we want to update
     *   }
     * })
     */
    upsert<T extends PersonAddressUpsertArgs>(args: SelectSubset<T, PersonAddressUpsertArgs<ExtArgs>>): Prisma__PersonAddressClient<$Result.GetResult<Prisma.$PersonAddressPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PersonAddresses.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAddressCountArgs} args - Arguments to filter PersonAddresses to count.
     * @example
     * // Count the number of PersonAddresses
     * const count = await prisma.personAddress.count({
     *   where: {
     *     // ... the filter for the PersonAddresses we want to count
     *   }
     * })
    **/
    count<T extends PersonAddressCountArgs>(
      args?: Subset<T, PersonAddressCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonAddressCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PersonAddress.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAddressAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PersonAddressAggregateArgs>(args: Subset<T, PersonAddressAggregateArgs>): Prisma.PrismaPromise<GetPersonAddressAggregateType<T>>

    /**
     * Group by PersonAddress.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAddressGroupByArgs} args - Group by arguments.
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
      T extends PersonAddressGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonAddressGroupByArgs['orderBy'] }
        : { orderBy?: PersonAddressGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, PersonAddressGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonAddressGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PersonAddress model
   */
  readonly fields: PersonAddressFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PersonAddress.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonAddressClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    person<T extends GlobalNaturalPersonDefaultArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPersonDefaultArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
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
   * Fields of the PersonAddress model
   */
  interface PersonAddressFieldRefs {
    readonly id: FieldRef<"PersonAddress", 'String'>
    readonly personId: FieldRef<"PersonAddress", 'String'>
    readonly kind: FieldRef<"PersonAddress", 'PersonAddressKind'>
    readonly lineCipher: FieldRef<"PersonAddress", 'String'>
    readonly cityCipher: FieldRef<"PersonAddress", 'String'>
    readonly regionCipher: FieldRef<"PersonAddress", 'String'>
    readonly postalCipher: FieldRef<"PersonAddress", 'String'>
    readonly createdAt: FieldRef<"PersonAddress", 'DateTime'>
    readonly updatedAt: FieldRef<"PersonAddress", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PersonAddress findUnique
   */
  export type PersonAddressFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * Filter, which PersonAddress to fetch.
     */
    where: PersonAddressWhereUniqueInput
  }

  /**
   * PersonAddress findUniqueOrThrow
   */
  export type PersonAddressFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * Filter, which PersonAddress to fetch.
     */
    where: PersonAddressWhereUniqueInput
  }

  /**
   * PersonAddress findFirst
   */
  export type PersonAddressFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * Filter, which PersonAddress to fetch.
     */
    where?: PersonAddressWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAddresses to fetch.
     */
    orderBy?: PersonAddressOrderByWithRelationInput | PersonAddressOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonAddresses.
     */
    cursor?: PersonAddressWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAddresses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAddresses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAddresses.
     */
    distinct?: PersonAddressScalarFieldEnum | PersonAddressScalarFieldEnum[]
  }

  /**
   * PersonAddress findFirstOrThrow
   */
  export type PersonAddressFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * Filter, which PersonAddress to fetch.
     */
    where?: PersonAddressWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAddresses to fetch.
     */
    orderBy?: PersonAddressOrderByWithRelationInput | PersonAddressOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonAddresses.
     */
    cursor?: PersonAddressWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAddresses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAddresses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAddresses.
     */
    distinct?: PersonAddressScalarFieldEnum | PersonAddressScalarFieldEnum[]
  }

  /**
   * PersonAddress findMany
   */
  export type PersonAddressFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * Filter, which PersonAddresses to fetch.
     */
    where?: PersonAddressWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAddresses to fetch.
     */
    orderBy?: PersonAddressOrderByWithRelationInput | PersonAddressOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PersonAddresses.
     */
    cursor?: PersonAddressWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAddresses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAddresses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAddresses.
     */
    distinct?: PersonAddressScalarFieldEnum | PersonAddressScalarFieldEnum[]
  }

  /**
   * PersonAddress create
   */
  export type PersonAddressCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * The data needed to create a PersonAddress.
     */
    data: XOR<PersonAddressCreateInput, PersonAddressUncheckedCreateInput>
  }

  /**
   * PersonAddress createMany
   */
  export type PersonAddressCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PersonAddresses.
     */
    data: PersonAddressCreateManyInput | PersonAddressCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PersonAddress createManyAndReturn
   */
  export type PersonAddressCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * The data used to create many PersonAddresses.
     */
    data: PersonAddressCreateManyInput | PersonAddressCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonAddress update
   */
  export type PersonAddressUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * The data needed to update a PersonAddress.
     */
    data: XOR<PersonAddressUpdateInput, PersonAddressUncheckedUpdateInput>
    /**
     * Choose, which PersonAddress to update.
     */
    where: PersonAddressWhereUniqueInput
  }

  /**
   * PersonAddress updateMany
   */
  export type PersonAddressUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PersonAddresses.
     */
    data: XOR<PersonAddressUpdateManyMutationInput, PersonAddressUncheckedUpdateManyInput>
    /**
     * Filter which PersonAddresses to update
     */
    where?: PersonAddressWhereInput
    /**
     * Limit how many PersonAddresses to update.
     */
    limit?: number
  }

  /**
   * PersonAddress updateManyAndReturn
   */
  export type PersonAddressUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * The data used to update PersonAddresses.
     */
    data: XOR<PersonAddressUpdateManyMutationInput, PersonAddressUncheckedUpdateManyInput>
    /**
     * Filter which PersonAddresses to update
     */
    where?: PersonAddressWhereInput
    /**
     * Limit how many PersonAddresses to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonAddress upsert
   */
  export type PersonAddressUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * The filter to search for the PersonAddress to update in case it exists.
     */
    where: PersonAddressWhereUniqueInput
    /**
     * In case the PersonAddress found by the `where` argument doesn't exist, create a new PersonAddress with this data.
     */
    create: XOR<PersonAddressCreateInput, PersonAddressUncheckedCreateInput>
    /**
     * In case the PersonAddress was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonAddressUpdateInput, PersonAddressUncheckedUpdateInput>
  }

  /**
   * PersonAddress delete
   */
  export type PersonAddressDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
    /**
     * Filter which PersonAddress to delete.
     */
    where: PersonAddressWhereUniqueInput
  }

  /**
   * PersonAddress deleteMany
   */
  export type PersonAddressDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonAddresses to delete
     */
    where?: PersonAddressWhereInput
    /**
     * Limit how many PersonAddresses to delete.
     */
    limit?: number
  }

  /**
   * PersonAddress without action
   */
  export type PersonAddressDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAddress
     */
    select?: PersonAddressSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAddress
     */
    omit?: PersonAddressOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAddressInclude<ExtArgs> | null
  }


  /**
   * Model PersonIdentifier
   */

  export type AggregatePersonIdentifier = {
    _count: PersonIdentifierCountAggregateOutputType | null
    _min: PersonIdentifierMinAggregateOutputType | null
    _max: PersonIdentifierMaxAggregateOutputType | null
  }

  export type PersonIdentifierMinAggregateOutputType = {
    id: string | null
    personId: string | null
    type: $Enums.PersonIdentifierType | null
    issuingCountry: string | null
    valueCipher: string | null
    blindIndex: string | null
    trust: $Enums.IdentifierTrust | null
    isPrimary: boolean | null
    createdAt: Date | null
  }

  export type PersonIdentifierMaxAggregateOutputType = {
    id: string | null
    personId: string | null
    type: $Enums.PersonIdentifierType | null
    issuingCountry: string | null
    valueCipher: string | null
    blindIndex: string | null
    trust: $Enums.IdentifierTrust | null
    isPrimary: boolean | null
    createdAt: Date | null
  }

  export type PersonIdentifierCountAggregateOutputType = {
    id: number
    personId: number
    type: number
    issuingCountry: number
    valueCipher: number
    blindIndex: number
    trust: number
    isPrimary: number
    createdAt: number
    _all: number
  }


  export type PersonIdentifierMinAggregateInputType = {
    id?: true
    personId?: true
    type?: true
    issuingCountry?: true
    valueCipher?: true
    blindIndex?: true
    trust?: true
    isPrimary?: true
    createdAt?: true
  }

  export type PersonIdentifierMaxAggregateInputType = {
    id?: true
    personId?: true
    type?: true
    issuingCountry?: true
    valueCipher?: true
    blindIndex?: true
    trust?: true
    isPrimary?: true
    createdAt?: true
  }

  export type PersonIdentifierCountAggregateInputType = {
    id?: true
    personId?: true
    type?: true
    issuingCountry?: true
    valueCipher?: true
    blindIndex?: true
    trust?: true
    isPrimary?: true
    createdAt?: true
    _all?: true
  }

  export type PersonIdentifierAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonIdentifier to aggregate.
     */
    where?: PersonIdentifierWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonIdentifiers to fetch.
     */
    orderBy?: PersonIdentifierOrderByWithRelationInput | PersonIdentifierOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonIdentifierWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonIdentifiers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonIdentifiers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PersonIdentifiers
    **/
    _count?: true | PersonIdentifierCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonIdentifierMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonIdentifierMaxAggregateInputType
  }

  export type GetPersonIdentifierAggregateType<T extends PersonIdentifierAggregateArgs> = {
        [P in keyof T & keyof AggregatePersonIdentifier]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersonIdentifier[P]>
      : GetScalarType<T[P], AggregatePersonIdentifier[P]>
  }




  export type PersonIdentifierGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonIdentifierWhereInput
    orderBy?: PersonIdentifierOrderByWithAggregationInput | PersonIdentifierOrderByWithAggregationInput[]
    by: PersonIdentifierScalarFieldEnum[] | PersonIdentifierScalarFieldEnum
    having?: PersonIdentifierScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonIdentifierCountAggregateInputType | true
    _min?: PersonIdentifierMinAggregateInputType
    _max?: PersonIdentifierMaxAggregateInputType
  }

  export type PersonIdentifierGroupByOutputType = {
    id: string
    personId: string
    type: $Enums.PersonIdentifierType
    issuingCountry: string
    valueCipher: string
    blindIndex: string
    trust: $Enums.IdentifierTrust
    isPrimary: boolean
    createdAt: Date
    _count: PersonIdentifierCountAggregateOutputType | null
    _min: PersonIdentifierMinAggregateOutputType | null
    _max: PersonIdentifierMaxAggregateOutputType | null
  }

  type GetPersonIdentifierGroupByPayload<T extends PersonIdentifierGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonIdentifierGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonIdentifierGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonIdentifierGroupByOutputType[P]>
            : GetScalarType<T[P], PersonIdentifierGroupByOutputType[P]>
        }
      >
    >


  export type PersonIdentifierSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    type?: boolean
    issuingCountry?: boolean
    valueCipher?: boolean
    blindIndex?: boolean
    trust?: boolean
    isPrimary?: boolean
    createdAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personIdentifier"]>

  export type PersonIdentifierSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    type?: boolean
    issuingCountry?: boolean
    valueCipher?: boolean
    blindIndex?: boolean
    trust?: boolean
    isPrimary?: boolean
    createdAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personIdentifier"]>

  export type PersonIdentifierSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    type?: boolean
    issuingCountry?: boolean
    valueCipher?: boolean
    blindIndex?: boolean
    trust?: boolean
    isPrimary?: boolean
    createdAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personIdentifier"]>

  export type PersonIdentifierSelectScalar = {
    id?: boolean
    personId?: boolean
    type?: boolean
    issuingCountry?: boolean
    valueCipher?: boolean
    blindIndex?: boolean
    trust?: boolean
    isPrimary?: boolean
    createdAt?: boolean
  }

  export type PersonIdentifierOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "personId" | "type" | "issuingCountry" | "valueCipher" | "blindIndex" | "trust" | "isPrimary" | "createdAt", ExtArgs["result"]["personIdentifier"]>
  export type PersonIdentifierInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonIdentifierIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonIdentifierIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }

  export type $PersonIdentifierPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PersonIdentifier"
    objects: {
      person: Prisma.$GlobalNaturalPersonPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      personId: string
      type: $Enums.PersonIdentifierType
      issuingCountry: string
      valueCipher: string
      blindIndex: string
      trust: $Enums.IdentifierTrust
      isPrimary: boolean
      createdAt: Date
    }, ExtArgs["result"]["personIdentifier"]>
    composites: {}
  }

  type PersonIdentifierGetPayload<S extends boolean | null | undefined | PersonIdentifierDefaultArgs> = $Result.GetResult<Prisma.$PersonIdentifierPayload, S>

  type PersonIdentifierCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonIdentifierFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonIdentifierCountAggregateInputType | true
    }

  export interface PersonIdentifierDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PersonIdentifier'], meta: { name: 'PersonIdentifier' } }
    /**
     * Find zero or one PersonIdentifier that matches the filter.
     * @param {PersonIdentifierFindUniqueArgs} args - Arguments to find a PersonIdentifier
     * @example
     * // Get one PersonIdentifier
     * const personIdentifier = await prisma.personIdentifier.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonIdentifierFindUniqueArgs>(args: SelectSubset<T, PersonIdentifierFindUniqueArgs<ExtArgs>>): Prisma__PersonIdentifierClient<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PersonIdentifier that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonIdentifierFindUniqueOrThrowArgs} args - Arguments to find a PersonIdentifier
     * @example
     * // Get one PersonIdentifier
     * const personIdentifier = await prisma.personIdentifier.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonIdentifierFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonIdentifierFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonIdentifierClient<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonIdentifier that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonIdentifierFindFirstArgs} args - Arguments to find a PersonIdentifier
     * @example
     * // Get one PersonIdentifier
     * const personIdentifier = await prisma.personIdentifier.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonIdentifierFindFirstArgs>(args?: SelectSubset<T, PersonIdentifierFindFirstArgs<ExtArgs>>): Prisma__PersonIdentifierClient<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonIdentifier that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonIdentifierFindFirstOrThrowArgs} args - Arguments to find a PersonIdentifier
     * @example
     * // Get one PersonIdentifier
     * const personIdentifier = await prisma.personIdentifier.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonIdentifierFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonIdentifierFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonIdentifierClient<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PersonIdentifiers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonIdentifierFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PersonIdentifiers
     * const personIdentifiers = await prisma.personIdentifier.findMany()
     * 
     * // Get first 10 PersonIdentifiers
     * const personIdentifiers = await prisma.personIdentifier.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personIdentifierWithIdOnly = await prisma.personIdentifier.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonIdentifierFindManyArgs>(args?: SelectSubset<T, PersonIdentifierFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PersonIdentifier.
     * @param {PersonIdentifierCreateArgs} args - Arguments to create a PersonIdentifier.
     * @example
     * // Create one PersonIdentifier
     * const PersonIdentifier = await prisma.personIdentifier.create({
     *   data: {
     *     // ... data to create a PersonIdentifier
     *   }
     * })
     * 
     */
    create<T extends PersonIdentifierCreateArgs>(args: SelectSubset<T, PersonIdentifierCreateArgs<ExtArgs>>): Prisma__PersonIdentifierClient<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PersonIdentifiers.
     * @param {PersonIdentifierCreateManyArgs} args - Arguments to create many PersonIdentifiers.
     * @example
     * // Create many PersonIdentifiers
     * const personIdentifier = await prisma.personIdentifier.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonIdentifierCreateManyArgs>(args?: SelectSubset<T, PersonIdentifierCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PersonIdentifiers and returns the data saved in the database.
     * @param {PersonIdentifierCreateManyAndReturnArgs} args - Arguments to create many PersonIdentifiers.
     * @example
     * // Create many PersonIdentifiers
     * const personIdentifier = await prisma.personIdentifier.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PersonIdentifiers and only return the `id`
     * const personIdentifierWithIdOnly = await prisma.personIdentifier.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonIdentifierCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonIdentifierCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PersonIdentifier.
     * @param {PersonIdentifierDeleteArgs} args - Arguments to delete one PersonIdentifier.
     * @example
     * // Delete one PersonIdentifier
     * const PersonIdentifier = await prisma.personIdentifier.delete({
     *   where: {
     *     // ... filter to delete one PersonIdentifier
     *   }
     * })
     * 
     */
    delete<T extends PersonIdentifierDeleteArgs>(args: SelectSubset<T, PersonIdentifierDeleteArgs<ExtArgs>>): Prisma__PersonIdentifierClient<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PersonIdentifier.
     * @param {PersonIdentifierUpdateArgs} args - Arguments to update one PersonIdentifier.
     * @example
     * // Update one PersonIdentifier
     * const personIdentifier = await prisma.personIdentifier.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonIdentifierUpdateArgs>(args: SelectSubset<T, PersonIdentifierUpdateArgs<ExtArgs>>): Prisma__PersonIdentifierClient<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PersonIdentifiers.
     * @param {PersonIdentifierDeleteManyArgs} args - Arguments to filter PersonIdentifiers to delete.
     * @example
     * // Delete a few PersonIdentifiers
     * const { count } = await prisma.personIdentifier.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonIdentifierDeleteManyArgs>(args?: SelectSubset<T, PersonIdentifierDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonIdentifiers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonIdentifierUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PersonIdentifiers
     * const personIdentifier = await prisma.personIdentifier.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonIdentifierUpdateManyArgs>(args: SelectSubset<T, PersonIdentifierUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonIdentifiers and returns the data updated in the database.
     * @param {PersonIdentifierUpdateManyAndReturnArgs} args - Arguments to update many PersonIdentifiers.
     * @example
     * // Update many PersonIdentifiers
     * const personIdentifier = await prisma.personIdentifier.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PersonIdentifiers and only return the `id`
     * const personIdentifierWithIdOnly = await prisma.personIdentifier.updateManyAndReturn({
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
    updateManyAndReturn<T extends PersonIdentifierUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonIdentifierUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PersonIdentifier.
     * @param {PersonIdentifierUpsertArgs} args - Arguments to update or create a PersonIdentifier.
     * @example
     * // Update or create a PersonIdentifier
     * const personIdentifier = await prisma.personIdentifier.upsert({
     *   create: {
     *     // ... data to create a PersonIdentifier
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PersonIdentifier we want to update
     *   }
     * })
     */
    upsert<T extends PersonIdentifierUpsertArgs>(args: SelectSubset<T, PersonIdentifierUpsertArgs<ExtArgs>>): Prisma__PersonIdentifierClient<$Result.GetResult<Prisma.$PersonIdentifierPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PersonIdentifiers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonIdentifierCountArgs} args - Arguments to filter PersonIdentifiers to count.
     * @example
     * // Count the number of PersonIdentifiers
     * const count = await prisma.personIdentifier.count({
     *   where: {
     *     // ... the filter for the PersonIdentifiers we want to count
     *   }
     * })
    **/
    count<T extends PersonIdentifierCountArgs>(
      args?: Subset<T, PersonIdentifierCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonIdentifierCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PersonIdentifier.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonIdentifierAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PersonIdentifierAggregateArgs>(args: Subset<T, PersonIdentifierAggregateArgs>): Prisma.PrismaPromise<GetPersonIdentifierAggregateType<T>>

    /**
     * Group by PersonIdentifier.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonIdentifierGroupByArgs} args - Group by arguments.
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
      T extends PersonIdentifierGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonIdentifierGroupByArgs['orderBy'] }
        : { orderBy?: PersonIdentifierGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, PersonIdentifierGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonIdentifierGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PersonIdentifier model
   */
  readonly fields: PersonIdentifierFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PersonIdentifier.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonIdentifierClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    person<T extends GlobalNaturalPersonDefaultArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPersonDefaultArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
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
   * Fields of the PersonIdentifier model
   */
  interface PersonIdentifierFieldRefs {
    readonly id: FieldRef<"PersonIdentifier", 'String'>
    readonly personId: FieldRef<"PersonIdentifier", 'String'>
    readonly type: FieldRef<"PersonIdentifier", 'PersonIdentifierType'>
    readonly issuingCountry: FieldRef<"PersonIdentifier", 'String'>
    readonly valueCipher: FieldRef<"PersonIdentifier", 'String'>
    readonly blindIndex: FieldRef<"PersonIdentifier", 'String'>
    readonly trust: FieldRef<"PersonIdentifier", 'IdentifierTrust'>
    readonly isPrimary: FieldRef<"PersonIdentifier", 'Boolean'>
    readonly createdAt: FieldRef<"PersonIdentifier", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PersonIdentifier findUnique
   */
  export type PersonIdentifierFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * Filter, which PersonIdentifier to fetch.
     */
    where: PersonIdentifierWhereUniqueInput
  }

  /**
   * PersonIdentifier findUniqueOrThrow
   */
  export type PersonIdentifierFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * Filter, which PersonIdentifier to fetch.
     */
    where: PersonIdentifierWhereUniqueInput
  }

  /**
   * PersonIdentifier findFirst
   */
  export type PersonIdentifierFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * Filter, which PersonIdentifier to fetch.
     */
    where?: PersonIdentifierWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonIdentifiers to fetch.
     */
    orderBy?: PersonIdentifierOrderByWithRelationInput | PersonIdentifierOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonIdentifiers.
     */
    cursor?: PersonIdentifierWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonIdentifiers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonIdentifiers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonIdentifiers.
     */
    distinct?: PersonIdentifierScalarFieldEnum | PersonIdentifierScalarFieldEnum[]
  }

  /**
   * PersonIdentifier findFirstOrThrow
   */
  export type PersonIdentifierFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * Filter, which PersonIdentifier to fetch.
     */
    where?: PersonIdentifierWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonIdentifiers to fetch.
     */
    orderBy?: PersonIdentifierOrderByWithRelationInput | PersonIdentifierOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonIdentifiers.
     */
    cursor?: PersonIdentifierWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonIdentifiers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonIdentifiers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonIdentifiers.
     */
    distinct?: PersonIdentifierScalarFieldEnum | PersonIdentifierScalarFieldEnum[]
  }

  /**
   * PersonIdentifier findMany
   */
  export type PersonIdentifierFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * Filter, which PersonIdentifiers to fetch.
     */
    where?: PersonIdentifierWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonIdentifiers to fetch.
     */
    orderBy?: PersonIdentifierOrderByWithRelationInput | PersonIdentifierOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PersonIdentifiers.
     */
    cursor?: PersonIdentifierWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonIdentifiers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonIdentifiers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonIdentifiers.
     */
    distinct?: PersonIdentifierScalarFieldEnum | PersonIdentifierScalarFieldEnum[]
  }

  /**
   * PersonIdentifier create
   */
  export type PersonIdentifierCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * The data needed to create a PersonIdentifier.
     */
    data: XOR<PersonIdentifierCreateInput, PersonIdentifierUncheckedCreateInput>
  }

  /**
   * PersonIdentifier createMany
   */
  export type PersonIdentifierCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PersonIdentifiers.
     */
    data: PersonIdentifierCreateManyInput | PersonIdentifierCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PersonIdentifier createManyAndReturn
   */
  export type PersonIdentifierCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * The data used to create many PersonIdentifiers.
     */
    data: PersonIdentifierCreateManyInput | PersonIdentifierCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonIdentifier update
   */
  export type PersonIdentifierUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * The data needed to update a PersonIdentifier.
     */
    data: XOR<PersonIdentifierUpdateInput, PersonIdentifierUncheckedUpdateInput>
    /**
     * Choose, which PersonIdentifier to update.
     */
    where: PersonIdentifierWhereUniqueInput
  }

  /**
   * PersonIdentifier updateMany
   */
  export type PersonIdentifierUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PersonIdentifiers.
     */
    data: XOR<PersonIdentifierUpdateManyMutationInput, PersonIdentifierUncheckedUpdateManyInput>
    /**
     * Filter which PersonIdentifiers to update
     */
    where?: PersonIdentifierWhereInput
    /**
     * Limit how many PersonIdentifiers to update.
     */
    limit?: number
  }

  /**
   * PersonIdentifier updateManyAndReturn
   */
  export type PersonIdentifierUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * The data used to update PersonIdentifiers.
     */
    data: XOR<PersonIdentifierUpdateManyMutationInput, PersonIdentifierUncheckedUpdateManyInput>
    /**
     * Filter which PersonIdentifiers to update
     */
    where?: PersonIdentifierWhereInput
    /**
     * Limit how many PersonIdentifiers to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonIdentifier upsert
   */
  export type PersonIdentifierUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * The filter to search for the PersonIdentifier to update in case it exists.
     */
    where: PersonIdentifierWhereUniqueInput
    /**
     * In case the PersonIdentifier found by the `where` argument doesn't exist, create a new PersonIdentifier with this data.
     */
    create: XOR<PersonIdentifierCreateInput, PersonIdentifierUncheckedCreateInput>
    /**
     * In case the PersonIdentifier was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonIdentifierUpdateInput, PersonIdentifierUncheckedUpdateInput>
  }

  /**
   * PersonIdentifier delete
   */
  export type PersonIdentifierDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
    /**
     * Filter which PersonIdentifier to delete.
     */
    where: PersonIdentifierWhereUniqueInput
  }

  /**
   * PersonIdentifier deleteMany
   */
  export type PersonIdentifierDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonIdentifiers to delete
     */
    where?: PersonIdentifierWhereInput
    /**
     * Limit how many PersonIdentifiers to delete.
     */
    limit?: number
  }

  /**
   * PersonIdentifier without action
   */
  export type PersonIdentifierDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonIdentifier
     */
    select?: PersonIdentifierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonIdentifier
     */
    omit?: PersonIdentifierOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonIdentifierInclude<ExtArgs> | null
  }


  /**
   * Model GlobalLegalEntity
   */

  export type AggregateGlobalLegalEntity = {
    _count: GlobalLegalEntityCountAggregateOutputType | null
    _min: GlobalLegalEntityMinAggregateOutputType | null
    _max: GlobalLegalEntityMaxAggregateOutputType | null
  }

  export type GlobalLegalEntityMinAggregateOutputType = {
    id: string | null
    taxIdBlindIndex: string | null
    taxIdCipher: string | null
    nameCipher: string | null
    organizationId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GlobalLegalEntityMaxAggregateOutputType = {
    id: string | null
    taxIdBlindIndex: string | null
    taxIdCipher: string | null
    nameCipher: string | null
    organizationId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GlobalLegalEntityCountAggregateOutputType = {
    id: number
    taxIdBlindIndex: number
    taxIdCipher: number
    nameCipher: number
    organizationId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type GlobalLegalEntityMinAggregateInputType = {
    id?: true
    taxIdBlindIndex?: true
    taxIdCipher?: true
    nameCipher?: true
    organizationId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GlobalLegalEntityMaxAggregateInputType = {
    id?: true
    taxIdBlindIndex?: true
    taxIdCipher?: true
    nameCipher?: true
    organizationId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GlobalLegalEntityCountAggregateInputType = {
    id?: true
    taxIdBlindIndex?: true
    taxIdCipher?: true
    nameCipher?: true
    organizationId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type GlobalLegalEntityAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GlobalLegalEntity to aggregate.
     */
    where?: GlobalLegalEntityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalLegalEntities to fetch.
     */
    orderBy?: GlobalLegalEntityOrderByWithRelationInput | GlobalLegalEntityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: GlobalLegalEntityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalLegalEntities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalLegalEntities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned GlobalLegalEntities
    **/
    _count?: true | GlobalLegalEntityCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GlobalLegalEntityMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GlobalLegalEntityMaxAggregateInputType
  }

  export type GetGlobalLegalEntityAggregateType<T extends GlobalLegalEntityAggregateArgs> = {
        [P in keyof T & keyof AggregateGlobalLegalEntity]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGlobalLegalEntity[P]>
      : GetScalarType<T[P], AggregateGlobalLegalEntity[P]>
  }




  export type GlobalLegalEntityGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GlobalLegalEntityWhereInput
    orderBy?: GlobalLegalEntityOrderByWithAggregationInput | GlobalLegalEntityOrderByWithAggregationInput[]
    by: GlobalLegalEntityScalarFieldEnum[] | GlobalLegalEntityScalarFieldEnum
    having?: GlobalLegalEntityScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GlobalLegalEntityCountAggregateInputType | true
    _min?: GlobalLegalEntityMinAggregateInputType
    _max?: GlobalLegalEntityMaxAggregateInputType
  }

  export type GlobalLegalEntityGroupByOutputType = {
    id: string
    taxIdBlindIndex: string
    taxIdCipher: string
    nameCipher: string
    organizationId: string | null
    createdAt: Date
    updatedAt: Date
    _count: GlobalLegalEntityCountAggregateOutputType | null
    _min: GlobalLegalEntityMinAggregateOutputType | null
    _max: GlobalLegalEntityMaxAggregateOutputType | null
  }

  type GetGlobalLegalEntityGroupByPayload<T extends GlobalLegalEntityGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GlobalLegalEntityGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GlobalLegalEntityGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GlobalLegalEntityGroupByOutputType[P]>
            : GetScalarType<T[P], GlobalLegalEntityGroupByOutputType[P]>
        }
      >
    >


  export type GlobalLegalEntitySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    taxIdBlindIndex?: boolean
    taxIdCipher?: boolean
    nameCipher?: boolean
    organizationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["globalLegalEntity"]>

  export type GlobalLegalEntitySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    taxIdBlindIndex?: boolean
    taxIdCipher?: boolean
    nameCipher?: boolean
    organizationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["globalLegalEntity"]>

  export type GlobalLegalEntitySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    taxIdBlindIndex?: boolean
    taxIdCipher?: boolean
    nameCipher?: boolean
    organizationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["globalLegalEntity"]>

  export type GlobalLegalEntitySelectScalar = {
    id?: boolean
    taxIdBlindIndex?: boolean
    taxIdCipher?: boolean
    nameCipher?: boolean
    organizationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type GlobalLegalEntityOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "taxIdBlindIndex" | "taxIdCipher" | "nameCipher" | "organizationId" | "createdAt" | "updatedAt", ExtArgs["result"]["globalLegalEntity"]>

  export type $GlobalLegalEntityPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "GlobalLegalEntity"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      taxIdBlindIndex: string
      taxIdCipher: string
      nameCipher: string
      organizationId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["globalLegalEntity"]>
    composites: {}
  }

  type GlobalLegalEntityGetPayload<S extends boolean | null | undefined | GlobalLegalEntityDefaultArgs> = $Result.GetResult<Prisma.$GlobalLegalEntityPayload, S>

  type GlobalLegalEntityCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<GlobalLegalEntityFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GlobalLegalEntityCountAggregateInputType | true
    }

  export interface GlobalLegalEntityDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['GlobalLegalEntity'], meta: { name: 'GlobalLegalEntity' } }
    /**
     * Find zero or one GlobalLegalEntity that matches the filter.
     * @param {GlobalLegalEntityFindUniqueArgs} args - Arguments to find a GlobalLegalEntity
     * @example
     * // Get one GlobalLegalEntity
     * const globalLegalEntity = await prisma.globalLegalEntity.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends GlobalLegalEntityFindUniqueArgs>(args: SelectSubset<T, GlobalLegalEntityFindUniqueArgs<ExtArgs>>): Prisma__GlobalLegalEntityClient<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one GlobalLegalEntity that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {GlobalLegalEntityFindUniqueOrThrowArgs} args - Arguments to find a GlobalLegalEntity
     * @example
     * // Get one GlobalLegalEntity
     * const globalLegalEntity = await prisma.globalLegalEntity.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends GlobalLegalEntityFindUniqueOrThrowArgs>(args: SelectSubset<T, GlobalLegalEntityFindUniqueOrThrowArgs<ExtArgs>>): Prisma__GlobalLegalEntityClient<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GlobalLegalEntity that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalLegalEntityFindFirstArgs} args - Arguments to find a GlobalLegalEntity
     * @example
     * // Get one GlobalLegalEntity
     * const globalLegalEntity = await prisma.globalLegalEntity.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends GlobalLegalEntityFindFirstArgs>(args?: SelectSubset<T, GlobalLegalEntityFindFirstArgs<ExtArgs>>): Prisma__GlobalLegalEntityClient<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GlobalLegalEntity that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalLegalEntityFindFirstOrThrowArgs} args - Arguments to find a GlobalLegalEntity
     * @example
     * // Get one GlobalLegalEntity
     * const globalLegalEntity = await prisma.globalLegalEntity.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends GlobalLegalEntityFindFirstOrThrowArgs>(args?: SelectSubset<T, GlobalLegalEntityFindFirstOrThrowArgs<ExtArgs>>): Prisma__GlobalLegalEntityClient<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more GlobalLegalEntities that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalLegalEntityFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all GlobalLegalEntities
     * const globalLegalEntities = await prisma.globalLegalEntity.findMany()
     * 
     * // Get first 10 GlobalLegalEntities
     * const globalLegalEntities = await prisma.globalLegalEntity.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const globalLegalEntityWithIdOnly = await prisma.globalLegalEntity.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends GlobalLegalEntityFindManyArgs>(args?: SelectSubset<T, GlobalLegalEntityFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a GlobalLegalEntity.
     * @param {GlobalLegalEntityCreateArgs} args - Arguments to create a GlobalLegalEntity.
     * @example
     * // Create one GlobalLegalEntity
     * const GlobalLegalEntity = await prisma.globalLegalEntity.create({
     *   data: {
     *     // ... data to create a GlobalLegalEntity
     *   }
     * })
     * 
     */
    create<T extends GlobalLegalEntityCreateArgs>(args: SelectSubset<T, GlobalLegalEntityCreateArgs<ExtArgs>>): Prisma__GlobalLegalEntityClient<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many GlobalLegalEntities.
     * @param {GlobalLegalEntityCreateManyArgs} args - Arguments to create many GlobalLegalEntities.
     * @example
     * // Create many GlobalLegalEntities
     * const globalLegalEntity = await prisma.globalLegalEntity.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends GlobalLegalEntityCreateManyArgs>(args?: SelectSubset<T, GlobalLegalEntityCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many GlobalLegalEntities and returns the data saved in the database.
     * @param {GlobalLegalEntityCreateManyAndReturnArgs} args - Arguments to create many GlobalLegalEntities.
     * @example
     * // Create many GlobalLegalEntities
     * const globalLegalEntity = await prisma.globalLegalEntity.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many GlobalLegalEntities and only return the `id`
     * const globalLegalEntityWithIdOnly = await prisma.globalLegalEntity.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends GlobalLegalEntityCreateManyAndReturnArgs>(args?: SelectSubset<T, GlobalLegalEntityCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a GlobalLegalEntity.
     * @param {GlobalLegalEntityDeleteArgs} args - Arguments to delete one GlobalLegalEntity.
     * @example
     * // Delete one GlobalLegalEntity
     * const GlobalLegalEntity = await prisma.globalLegalEntity.delete({
     *   where: {
     *     // ... filter to delete one GlobalLegalEntity
     *   }
     * })
     * 
     */
    delete<T extends GlobalLegalEntityDeleteArgs>(args: SelectSubset<T, GlobalLegalEntityDeleteArgs<ExtArgs>>): Prisma__GlobalLegalEntityClient<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one GlobalLegalEntity.
     * @param {GlobalLegalEntityUpdateArgs} args - Arguments to update one GlobalLegalEntity.
     * @example
     * // Update one GlobalLegalEntity
     * const globalLegalEntity = await prisma.globalLegalEntity.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends GlobalLegalEntityUpdateArgs>(args: SelectSubset<T, GlobalLegalEntityUpdateArgs<ExtArgs>>): Prisma__GlobalLegalEntityClient<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more GlobalLegalEntities.
     * @param {GlobalLegalEntityDeleteManyArgs} args - Arguments to filter GlobalLegalEntities to delete.
     * @example
     * // Delete a few GlobalLegalEntities
     * const { count } = await prisma.globalLegalEntity.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends GlobalLegalEntityDeleteManyArgs>(args?: SelectSubset<T, GlobalLegalEntityDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GlobalLegalEntities.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalLegalEntityUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many GlobalLegalEntities
     * const globalLegalEntity = await prisma.globalLegalEntity.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends GlobalLegalEntityUpdateManyArgs>(args: SelectSubset<T, GlobalLegalEntityUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GlobalLegalEntities and returns the data updated in the database.
     * @param {GlobalLegalEntityUpdateManyAndReturnArgs} args - Arguments to update many GlobalLegalEntities.
     * @example
     * // Update many GlobalLegalEntities
     * const globalLegalEntity = await prisma.globalLegalEntity.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more GlobalLegalEntities and only return the `id`
     * const globalLegalEntityWithIdOnly = await prisma.globalLegalEntity.updateManyAndReturn({
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
    updateManyAndReturn<T extends GlobalLegalEntityUpdateManyAndReturnArgs>(args: SelectSubset<T, GlobalLegalEntityUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one GlobalLegalEntity.
     * @param {GlobalLegalEntityUpsertArgs} args - Arguments to update or create a GlobalLegalEntity.
     * @example
     * // Update or create a GlobalLegalEntity
     * const globalLegalEntity = await prisma.globalLegalEntity.upsert({
     *   create: {
     *     // ... data to create a GlobalLegalEntity
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the GlobalLegalEntity we want to update
     *   }
     * })
     */
    upsert<T extends GlobalLegalEntityUpsertArgs>(args: SelectSubset<T, GlobalLegalEntityUpsertArgs<ExtArgs>>): Prisma__GlobalLegalEntityClient<$Result.GetResult<Prisma.$GlobalLegalEntityPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of GlobalLegalEntities.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalLegalEntityCountArgs} args - Arguments to filter GlobalLegalEntities to count.
     * @example
     * // Count the number of GlobalLegalEntities
     * const count = await prisma.globalLegalEntity.count({
     *   where: {
     *     // ... the filter for the GlobalLegalEntities we want to count
     *   }
     * })
    **/
    count<T extends GlobalLegalEntityCountArgs>(
      args?: Subset<T, GlobalLegalEntityCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GlobalLegalEntityCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a GlobalLegalEntity.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalLegalEntityAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends GlobalLegalEntityAggregateArgs>(args: Subset<T, GlobalLegalEntityAggregateArgs>): Prisma.PrismaPromise<GetGlobalLegalEntityAggregateType<T>>

    /**
     * Group by GlobalLegalEntity.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GlobalLegalEntityGroupByArgs} args - Group by arguments.
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
      T extends GlobalLegalEntityGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: GlobalLegalEntityGroupByArgs['orderBy'] }
        : { orderBy?: GlobalLegalEntityGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, GlobalLegalEntityGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGlobalLegalEntityGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the GlobalLegalEntity model
   */
  readonly fields: GlobalLegalEntityFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for GlobalLegalEntity.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__GlobalLegalEntityClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
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
   * Fields of the GlobalLegalEntity model
   */
  interface GlobalLegalEntityFieldRefs {
    readonly id: FieldRef<"GlobalLegalEntity", 'String'>
    readonly taxIdBlindIndex: FieldRef<"GlobalLegalEntity", 'String'>
    readonly taxIdCipher: FieldRef<"GlobalLegalEntity", 'String'>
    readonly nameCipher: FieldRef<"GlobalLegalEntity", 'String'>
    readonly organizationId: FieldRef<"GlobalLegalEntity", 'String'>
    readonly createdAt: FieldRef<"GlobalLegalEntity", 'DateTime'>
    readonly updatedAt: FieldRef<"GlobalLegalEntity", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * GlobalLegalEntity findUnique
   */
  export type GlobalLegalEntityFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * Filter, which GlobalLegalEntity to fetch.
     */
    where: GlobalLegalEntityWhereUniqueInput
  }

  /**
   * GlobalLegalEntity findUniqueOrThrow
   */
  export type GlobalLegalEntityFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * Filter, which GlobalLegalEntity to fetch.
     */
    where: GlobalLegalEntityWhereUniqueInput
  }

  /**
   * GlobalLegalEntity findFirst
   */
  export type GlobalLegalEntityFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * Filter, which GlobalLegalEntity to fetch.
     */
    where?: GlobalLegalEntityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalLegalEntities to fetch.
     */
    orderBy?: GlobalLegalEntityOrderByWithRelationInput | GlobalLegalEntityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GlobalLegalEntities.
     */
    cursor?: GlobalLegalEntityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalLegalEntities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalLegalEntities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalLegalEntities.
     */
    distinct?: GlobalLegalEntityScalarFieldEnum | GlobalLegalEntityScalarFieldEnum[]
  }

  /**
   * GlobalLegalEntity findFirstOrThrow
   */
  export type GlobalLegalEntityFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * Filter, which GlobalLegalEntity to fetch.
     */
    where?: GlobalLegalEntityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalLegalEntities to fetch.
     */
    orderBy?: GlobalLegalEntityOrderByWithRelationInput | GlobalLegalEntityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GlobalLegalEntities.
     */
    cursor?: GlobalLegalEntityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalLegalEntities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalLegalEntities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalLegalEntities.
     */
    distinct?: GlobalLegalEntityScalarFieldEnum | GlobalLegalEntityScalarFieldEnum[]
  }

  /**
   * GlobalLegalEntity findMany
   */
  export type GlobalLegalEntityFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * Filter, which GlobalLegalEntities to fetch.
     */
    where?: GlobalLegalEntityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GlobalLegalEntities to fetch.
     */
    orderBy?: GlobalLegalEntityOrderByWithRelationInput | GlobalLegalEntityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing GlobalLegalEntities.
     */
    cursor?: GlobalLegalEntityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GlobalLegalEntities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GlobalLegalEntities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GlobalLegalEntities.
     */
    distinct?: GlobalLegalEntityScalarFieldEnum | GlobalLegalEntityScalarFieldEnum[]
  }

  /**
   * GlobalLegalEntity create
   */
  export type GlobalLegalEntityCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * The data needed to create a GlobalLegalEntity.
     */
    data: XOR<GlobalLegalEntityCreateInput, GlobalLegalEntityUncheckedCreateInput>
  }

  /**
   * GlobalLegalEntity createMany
   */
  export type GlobalLegalEntityCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many GlobalLegalEntities.
     */
    data: GlobalLegalEntityCreateManyInput | GlobalLegalEntityCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GlobalLegalEntity createManyAndReturn
   */
  export type GlobalLegalEntityCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * The data used to create many GlobalLegalEntities.
     */
    data: GlobalLegalEntityCreateManyInput | GlobalLegalEntityCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GlobalLegalEntity update
   */
  export type GlobalLegalEntityUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * The data needed to update a GlobalLegalEntity.
     */
    data: XOR<GlobalLegalEntityUpdateInput, GlobalLegalEntityUncheckedUpdateInput>
    /**
     * Choose, which GlobalLegalEntity to update.
     */
    where: GlobalLegalEntityWhereUniqueInput
  }

  /**
   * GlobalLegalEntity updateMany
   */
  export type GlobalLegalEntityUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update GlobalLegalEntities.
     */
    data: XOR<GlobalLegalEntityUpdateManyMutationInput, GlobalLegalEntityUncheckedUpdateManyInput>
    /**
     * Filter which GlobalLegalEntities to update
     */
    where?: GlobalLegalEntityWhereInput
    /**
     * Limit how many GlobalLegalEntities to update.
     */
    limit?: number
  }

  /**
   * GlobalLegalEntity updateManyAndReturn
   */
  export type GlobalLegalEntityUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * The data used to update GlobalLegalEntities.
     */
    data: XOR<GlobalLegalEntityUpdateManyMutationInput, GlobalLegalEntityUncheckedUpdateManyInput>
    /**
     * Filter which GlobalLegalEntities to update
     */
    where?: GlobalLegalEntityWhereInput
    /**
     * Limit how many GlobalLegalEntities to update.
     */
    limit?: number
  }

  /**
   * GlobalLegalEntity upsert
   */
  export type GlobalLegalEntityUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * The filter to search for the GlobalLegalEntity to update in case it exists.
     */
    where: GlobalLegalEntityWhereUniqueInput
    /**
     * In case the GlobalLegalEntity found by the `where` argument doesn't exist, create a new GlobalLegalEntity with this data.
     */
    create: XOR<GlobalLegalEntityCreateInput, GlobalLegalEntityUncheckedCreateInput>
    /**
     * In case the GlobalLegalEntity was found with the provided `where` argument, update it with this data.
     */
    update: XOR<GlobalLegalEntityUpdateInput, GlobalLegalEntityUncheckedUpdateInput>
  }

  /**
   * GlobalLegalEntity delete
   */
  export type GlobalLegalEntityDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
    /**
     * Filter which GlobalLegalEntity to delete.
     */
    where: GlobalLegalEntityWhereUniqueInput
  }

  /**
   * GlobalLegalEntity deleteMany
   */
  export type GlobalLegalEntityDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GlobalLegalEntities to delete
     */
    where?: GlobalLegalEntityWhereInput
    /**
     * Limit how many GlobalLegalEntities to delete.
     */
    limit?: number
  }

  /**
   * GlobalLegalEntity without action
   */
  export type GlobalLegalEntityDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GlobalLegalEntity
     */
    select?: GlobalLegalEntitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the GlobalLegalEntity
     */
    omit?: GlobalLegalEntityOmit<ExtArgs> | null
  }


  /**
   * Model PersonAccessRequest
   */

  export type AggregatePersonAccessRequest = {
    _count: PersonAccessRequestCountAggregateOutputType | null
    _min: PersonAccessRequestMinAggregateOutputType | null
    _max: PersonAccessRequestMaxAggregateOutputType | null
  }

  export type PersonAccessRequestMinAggregateOutputType = {
    id: string | null
    personId: string | null
    requesterOrgId: string | null
    purpose: string | null
    status: $Enums.PersonAccessRequestStatus | null
    createdAt: Date | null
    decidedAt: Date | null
  }

  export type PersonAccessRequestMaxAggregateOutputType = {
    id: string | null
    personId: string | null
    requesterOrgId: string | null
    purpose: string | null
    status: $Enums.PersonAccessRequestStatus | null
    createdAt: Date | null
    decidedAt: Date | null
  }

  export type PersonAccessRequestCountAggregateOutputType = {
    id: number
    personId: number
    requesterOrgId: number
    purpose: number
    status: number
    createdAt: number
    decidedAt: number
    _all: number
  }


  export type PersonAccessRequestMinAggregateInputType = {
    id?: true
    personId?: true
    requesterOrgId?: true
    purpose?: true
    status?: true
    createdAt?: true
    decidedAt?: true
  }

  export type PersonAccessRequestMaxAggregateInputType = {
    id?: true
    personId?: true
    requesterOrgId?: true
    purpose?: true
    status?: true
    createdAt?: true
    decidedAt?: true
  }

  export type PersonAccessRequestCountAggregateInputType = {
    id?: true
    personId?: true
    requesterOrgId?: true
    purpose?: true
    status?: true
    createdAt?: true
    decidedAt?: true
    _all?: true
  }

  export type PersonAccessRequestAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonAccessRequest to aggregate.
     */
    where?: PersonAccessRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessRequests to fetch.
     */
    orderBy?: PersonAccessRequestOrderByWithRelationInput | PersonAccessRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonAccessRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PersonAccessRequests
    **/
    _count?: true | PersonAccessRequestCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonAccessRequestMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonAccessRequestMaxAggregateInputType
  }

  export type GetPersonAccessRequestAggregateType<T extends PersonAccessRequestAggregateArgs> = {
        [P in keyof T & keyof AggregatePersonAccessRequest]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersonAccessRequest[P]>
      : GetScalarType<T[P], AggregatePersonAccessRequest[P]>
  }




  export type PersonAccessRequestGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonAccessRequestWhereInput
    orderBy?: PersonAccessRequestOrderByWithAggregationInput | PersonAccessRequestOrderByWithAggregationInput[]
    by: PersonAccessRequestScalarFieldEnum[] | PersonAccessRequestScalarFieldEnum
    having?: PersonAccessRequestScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonAccessRequestCountAggregateInputType | true
    _min?: PersonAccessRequestMinAggregateInputType
    _max?: PersonAccessRequestMaxAggregateInputType
  }

  export type PersonAccessRequestGroupByOutputType = {
    id: string
    personId: string
    requesterOrgId: string
    purpose: string
    status: $Enums.PersonAccessRequestStatus
    createdAt: Date
    decidedAt: Date | null
    _count: PersonAccessRequestCountAggregateOutputType | null
    _min: PersonAccessRequestMinAggregateOutputType | null
    _max: PersonAccessRequestMaxAggregateOutputType | null
  }

  type GetPersonAccessRequestGroupByPayload<T extends PersonAccessRequestGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonAccessRequestGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonAccessRequestGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonAccessRequestGroupByOutputType[P]>
            : GetScalarType<T[P], PersonAccessRequestGroupByOutputType[P]>
        }
      >
    >


  export type PersonAccessRequestSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    requesterOrgId?: boolean
    purpose?: boolean
    status?: boolean
    createdAt?: boolean
    decidedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessRequest"]>

  export type PersonAccessRequestSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    requesterOrgId?: boolean
    purpose?: boolean
    status?: boolean
    createdAt?: boolean
    decidedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessRequest"]>

  export type PersonAccessRequestSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    requesterOrgId?: boolean
    purpose?: boolean
    status?: boolean
    createdAt?: boolean
    decidedAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessRequest"]>

  export type PersonAccessRequestSelectScalar = {
    id?: boolean
    personId?: boolean
    requesterOrgId?: boolean
    purpose?: boolean
    status?: boolean
    createdAt?: boolean
    decidedAt?: boolean
  }

  export type PersonAccessRequestOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "personId" | "requesterOrgId" | "purpose" | "status" | "createdAt" | "decidedAt", ExtArgs["result"]["personAccessRequest"]>
  export type PersonAccessRequestInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonAccessRequestIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonAccessRequestIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }

  export type $PersonAccessRequestPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PersonAccessRequest"
    objects: {
      person: Prisma.$GlobalNaturalPersonPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      personId: string
      requesterOrgId: string
      purpose: string
      status: $Enums.PersonAccessRequestStatus
      createdAt: Date
      decidedAt: Date | null
    }, ExtArgs["result"]["personAccessRequest"]>
    composites: {}
  }

  type PersonAccessRequestGetPayload<S extends boolean | null | undefined | PersonAccessRequestDefaultArgs> = $Result.GetResult<Prisma.$PersonAccessRequestPayload, S>

  type PersonAccessRequestCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonAccessRequestFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonAccessRequestCountAggregateInputType | true
    }

  export interface PersonAccessRequestDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PersonAccessRequest'], meta: { name: 'PersonAccessRequest' } }
    /**
     * Find zero or one PersonAccessRequest that matches the filter.
     * @param {PersonAccessRequestFindUniqueArgs} args - Arguments to find a PersonAccessRequest
     * @example
     * // Get one PersonAccessRequest
     * const personAccessRequest = await prisma.personAccessRequest.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonAccessRequestFindUniqueArgs>(args: SelectSubset<T, PersonAccessRequestFindUniqueArgs<ExtArgs>>): Prisma__PersonAccessRequestClient<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PersonAccessRequest that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonAccessRequestFindUniqueOrThrowArgs} args - Arguments to find a PersonAccessRequest
     * @example
     * // Get one PersonAccessRequest
     * const personAccessRequest = await prisma.personAccessRequest.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonAccessRequestFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonAccessRequestFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonAccessRequestClient<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonAccessRequest that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessRequestFindFirstArgs} args - Arguments to find a PersonAccessRequest
     * @example
     * // Get one PersonAccessRequest
     * const personAccessRequest = await prisma.personAccessRequest.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonAccessRequestFindFirstArgs>(args?: SelectSubset<T, PersonAccessRequestFindFirstArgs<ExtArgs>>): Prisma__PersonAccessRequestClient<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonAccessRequest that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessRequestFindFirstOrThrowArgs} args - Arguments to find a PersonAccessRequest
     * @example
     * // Get one PersonAccessRequest
     * const personAccessRequest = await prisma.personAccessRequest.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonAccessRequestFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonAccessRequestFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonAccessRequestClient<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PersonAccessRequests that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessRequestFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PersonAccessRequests
     * const personAccessRequests = await prisma.personAccessRequest.findMany()
     * 
     * // Get first 10 PersonAccessRequests
     * const personAccessRequests = await prisma.personAccessRequest.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personAccessRequestWithIdOnly = await prisma.personAccessRequest.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonAccessRequestFindManyArgs>(args?: SelectSubset<T, PersonAccessRequestFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PersonAccessRequest.
     * @param {PersonAccessRequestCreateArgs} args - Arguments to create a PersonAccessRequest.
     * @example
     * // Create one PersonAccessRequest
     * const PersonAccessRequest = await prisma.personAccessRequest.create({
     *   data: {
     *     // ... data to create a PersonAccessRequest
     *   }
     * })
     * 
     */
    create<T extends PersonAccessRequestCreateArgs>(args: SelectSubset<T, PersonAccessRequestCreateArgs<ExtArgs>>): Prisma__PersonAccessRequestClient<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PersonAccessRequests.
     * @param {PersonAccessRequestCreateManyArgs} args - Arguments to create many PersonAccessRequests.
     * @example
     * // Create many PersonAccessRequests
     * const personAccessRequest = await prisma.personAccessRequest.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonAccessRequestCreateManyArgs>(args?: SelectSubset<T, PersonAccessRequestCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PersonAccessRequests and returns the data saved in the database.
     * @param {PersonAccessRequestCreateManyAndReturnArgs} args - Arguments to create many PersonAccessRequests.
     * @example
     * // Create many PersonAccessRequests
     * const personAccessRequest = await prisma.personAccessRequest.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PersonAccessRequests and only return the `id`
     * const personAccessRequestWithIdOnly = await prisma.personAccessRequest.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonAccessRequestCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonAccessRequestCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PersonAccessRequest.
     * @param {PersonAccessRequestDeleteArgs} args - Arguments to delete one PersonAccessRequest.
     * @example
     * // Delete one PersonAccessRequest
     * const PersonAccessRequest = await prisma.personAccessRequest.delete({
     *   where: {
     *     // ... filter to delete one PersonAccessRequest
     *   }
     * })
     * 
     */
    delete<T extends PersonAccessRequestDeleteArgs>(args: SelectSubset<T, PersonAccessRequestDeleteArgs<ExtArgs>>): Prisma__PersonAccessRequestClient<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PersonAccessRequest.
     * @param {PersonAccessRequestUpdateArgs} args - Arguments to update one PersonAccessRequest.
     * @example
     * // Update one PersonAccessRequest
     * const personAccessRequest = await prisma.personAccessRequest.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonAccessRequestUpdateArgs>(args: SelectSubset<T, PersonAccessRequestUpdateArgs<ExtArgs>>): Prisma__PersonAccessRequestClient<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PersonAccessRequests.
     * @param {PersonAccessRequestDeleteManyArgs} args - Arguments to filter PersonAccessRequests to delete.
     * @example
     * // Delete a few PersonAccessRequests
     * const { count } = await prisma.personAccessRequest.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonAccessRequestDeleteManyArgs>(args?: SelectSubset<T, PersonAccessRequestDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonAccessRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessRequestUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PersonAccessRequests
     * const personAccessRequest = await prisma.personAccessRequest.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonAccessRequestUpdateManyArgs>(args: SelectSubset<T, PersonAccessRequestUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonAccessRequests and returns the data updated in the database.
     * @param {PersonAccessRequestUpdateManyAndReturnArgs} args - Arguments to update many PersonAccessRequests.
     * @example
     * // Update many PersonAccessRequests
     * const personAccessRequest = await prisma.personAccessRequest.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PersonAccessRequests and only return the `id`
     * const personAccessRequestWithIdOnly = await prisma.personAccessRequest.updateManyAndReturn({
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
    updateManyAndReturn<T extends PersonAccessRequestUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonAccessRequestUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PersonAccessRequest.
     * @param {PersonAccessRequestUpsertArgs} args - Arguments to update or create a PersonAccessRequest.
     * @example
     * // Update or create a PersonAccessRequest
     * const personAccessRequest = await prisma.personAccessRequest.upsert({
     *   create: {
     *     // ... data to create a PersonAccessRequest
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PersonAccessRequest we want to update
     *   }
     * })
     */
    upsert<T extends PersonAccessRequestUpsertArgs>(args: SelectSubset<T, PersonAccessRequestUpsertArgs<ExtArgs>>): Prisma__PersonAccessRequestClient<$Result.GetResult<Prisma.$PersonAccessRequestPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PersonAccessRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessRequestCountArgs} args - Arguments to filter PersonAccessRequests to count.
     * @example
     * // Count the number of PersonAccessRequests
     * const count = await prisma.personAccessRequest.count({
     *   where: {
     *     // ... the filter for the PersonAccessRequests we want to count
     *   }
     * })
    **/
    count<T extends PersonAccessRequestCountArgs>(
      args?: Subset<T, PersonAccessRequestCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonAccessRequestCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PersonAccessRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessRequestAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PersonAccessRequestAggregateArgs>(args: Subset<T, PersonAccessRequestAggregateArgs>): Prisma.PrismaPromise<GetPersonAccessRequestAggregateType<T>>

    /**
     * Group by PersonAccessRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessRequestGroupByArgs} args - Group by arguments.
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
      T extends PersonAccessRequestGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonAccessRequestGroupByArgs['orderBy'] }
        : { orderBy?: PersonAccessRequestGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, PersonAccessRequestGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonAccessRequestGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PersonAccessRequest model
   */
  readonly fields: PersonAccessRequestFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PersonAccessRequest.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonAccessRequestClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    person<T extends GlobalNaturalPersonDefaultArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPersonDefaultArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
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
   * Fields of the PersonAccessRequest model
   */
  interface PersonAccessRequestFieldRefs {
    readonly id: FieldRef<"PersonAccessRequest", 'String'>
    readonly personId: FieldRef<"PersonAccessRequest", 'String'>
    readonly requesterOrgId: FieldRef<"PersonAccessRequest", 'String'>
    readonly purpose: FieldRef<"PersonAccessRequest", 'String'>
    readonly status: FieldRef<"PersonAccessRequest", 'PersonAccessRequestStatus'>
    readonly createdAt: FieldRef<"PersonAccessRequest", 'DateTime'>
    readonly decidedAt: FieldRef<"PersonAccessRequest", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PersonAccessRequest findUnique
   */
  export type PersonAccessRequestFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessRequest to fetch.
     */
    where: PersonAccessRequestWhereUniqueInput
  }

  /**
   * PersonAccessRequest findUniqueOrThrow
   */
  export type PersonAccessRequestFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessRequest to fetch.
     */
    where: PersonAccessRequestWhereUniqueInput
  }

  /**
   * PersonAccessRequest findFirst
   */
  export type PersonAccessRequestFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessRequest to fetch.
     */
    where?: PersonAccessRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessRequests to fetch.
     */
    orderBy?: PersonAccessRequestOrderByWithRelationInput | PersonAccessRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonAccessRequests.
     */
    cursor?: PersonAccessRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessRequests.
     */
    distinct?: PersonAccessRequestScalarFieldEnum | PersonAccessRequestScalarFieldEnum[]
  }

  /**
   * PersonAccessRequest findFirstOrThrow
   */
  export type PersonAccessRequestFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessRequest to fetch.
     */
    where?: PersonAccessRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessRequests to fetch.
     */
    orderBy?: PersonAccessRequestOrderByWithRelationInput | PersonAccessRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonAccessRequests.
     */
    cursor?: PersonAccessRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessRequests.
     */
    distinct?: PersonAccessRequestScalarFieldEnum | PersonAccessRequestScalarFieldEnum[]
  }

  /**
   * PersonAccessRequest findMany
   */
  export type PersonAccessRequestFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessRequests to fetch.
     */
    where?: PersonAccessRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessRequests to fetch.
     */
    orderBy?: PersonAccessRequestOrderByWithRelationInput | PersonAccessRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PersonAccessRequests.
     */
    cursor?: PersonAccessRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessRequests.
     */
    distinct?: PersonAccessRequestScalarFieldEnum | PersonAccessRequestScalarFieldEnum[]
  }

  /**
   * PersonAccessRequest create
   */
  export type PersonAccessRequestCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * The data needed to create a PersonAccessRequest.
     */
    data: XOR<PersonAccessRequestCreateInput, PersonAccessRequestUncheckedCreateInput>
  }

  /**
   * PersonAccessRequest createMany
   */
  export type PersonAccessRequestCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PersonAccessRequests.
     */
    data: PersonAccessRequestCreateManyInput | PersonAccessRequestCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PersonAccessRequest createManyAndReturn
   */
  export type PersonAccessRequestCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * The data used to create many PersonAccessRequests.
     */
    data: PersonAccessRequestCreateManyInput | PersonAccessRequestCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonAccessRequest update
   */
  export type PersonAccessRequestUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * The data needed to update a PersonAccessRequest.
     */
    data: XOR<PersonAccessRequestUpdateInput, PersonAccessRequestUncheckedUpdateInput>
    /**
     * Choose, which PersonAccessRequest to update.
     */
    where: PersonAccessRequestWhereUniqueInput
  }

  /**
   * PersonAccessRequest updateMany
   */
  export type PersonAccessRequestUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PersonAccessRequests.
     */
    data: XOR<PersonAccessRequestUpdateManyMutationInput, PersonAccessRequestUncheckedUpdateManyInput>
    /**
     * Filter which PersonAccessRequests to update
     */
    where?: PersonAccessRequestWhereInput
    /**
     * Limit how many PersonAccessRequests to update.
     */
    limit?: number
  }

  /**
   * PersonAccessRequest updateManyAndReturn
   */
  export type PersonAccessRequestUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * The data used to update PersonAccessRequests.
     */
    data: XOR<PersonAccessRequestUpdateManyMutationInput, PersonAccessRequestUncheckedUpdateManyInput>
    /**
     * Filter which PersonAccessRequests to update
     */
    where?: PersonAccessRequestWhereInput
    /**
     * Limit how many PersonAccessRequests to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonAccessRequest upsert
   */
  export type PersonAccessRequestUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * The filter to search for the PersonAccessRequest to update in case it exists.
     */
    where: PersonAccessRequestWhereUniqueInput
    /**
     * In case the PersonAccessRequest found by the `where` argument doesn't exist, create a new PersonAccessRequest with this data.
     */
    create: XOR<PersonAccessRequestCreateInput, PersonAccessRequestUncheckedCreateInput>
    /**
     * In case the PersonAccessRequest was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonAccessRequestUpdateInput, PersonAccessRequestUncheckedUpdateInput>
  }

  /**
   * PersonAccessRequest delete
   */
  export type PersonAccessRequestDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
    /**
     * Filter which PersonAccessRequest to delete.
     */
    where: PersonAccessRequestWhereUniqueInput
  }

  /**
   * PersonAccessRequest deleteMany
   */
  export type PersonAccessRequestDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonAccessRequests to delete
     */
    where?: PersonAccessRequestWhereInput
    /**
     * Limit how many PersonAccessRequests to delete.
     */
    limit?: number
  }

  /**
   * PersonAccessRequest without action
   */
  export type PersonAccessRequestDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessRequest
     */
    select?: PersonAccessRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessRequest
     */
    omit?: PersonAccessRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessRequestInclude<ExtArgs> | null
  }


  /**
   * Model PersonAccessGrant
   */

  export type AggregatePersonAccessGrant = {
    _count: PersonAccessGrantCountAggregateOutputType | null
    _min: PersonAccessGrantMinAggregateOutputType | null
    _max: PersonAccessGrantMaxAggregateOutputType | null
  }

  export type PersonAccessGrantMinAggregateOutputType = {
    id: string | null
    personId: string | null
    granteeOrgId: string | null
    grantedAt: Date | null
    expiresAt: Date | null
  }

  export type PersonAccessGrantMaxAggregateOutputType = {
    id: string | null
    personId: string | null
    granteeOrgId: string | null
    grantedAt: Date | null
    expiresAt: Date | null
  }

  export type PersonAccessGrantCountAggregateOutputType = {
    id: number
    personId: number
    granteeOrgId: number
    grantedAt: number
    expiresAt: number
    _all: number
  }


  export type PersonAccessGrantMinAggregateInputType = {
    id?: true
    personId?: true
    granteeOrgId?: true
    grantedAt?: true
    expiresAt?: true
  }

  export type PersonAccessGrantMaxAggregateInputType = {
    id?: true
    personId?: true
    granteeOrgId?: true
    grantedAt?: true
    expiresAt?: true
  }

  export type PersonAccessGrantCountAggregateInputType = {
    id?: true
    personId?: true
    granteeOrgId?: true
    grantedAt?: true
    expiresAt?: true
    _all?: true
  }

  export type PersonAccessGrantAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonAccessGrant to aggregate.
     */
    where?: PersonAccessGrantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessGrants to fetch.
     */
    orderBy?: PersonAccessGrantOrderByWithRelationInput | PersonAccessGrantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonAccessGrantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessGrants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessGrants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PersonAccessGrants
    **/
    _count?: true | PersonAccessGrantCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonAccessGrantMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonAccessGrantMaxAggregateInputType
  }

  export type GetPersonAccessGrantAggregateType<T extends PersonAccessGrantAggregateArgs> = {
        [P in keyof T & keyof AggregatePersonAccessGrant]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersonAccessGrant[P]>
      : GetScalarType<T[P], AggregatePersonAccessGrant[P]>
  }




  export type PersonAccessGrantGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonAccessGrantWhereInput
    orderBy?: PersonAccessGrantOrderByWithAggregationInput | PersonAccessGrantOrderByWithAggregationInput[]
    by: PersonAccessGrantScalarFieldEnum[] | PersonAccessGrantScalarFieldEnum
    having?: PersonAccessGrantScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonAccessGrantCountAggregateInputType | true
    _min?: PersonAccessGrantMinAggregateInputType
    _max?: PersonAccessGrantMaxAggregateInputType
  }

  export type PersonAccessGrantGroupByOutputType = {
    id: string
    personId: string
    granteeOrgId: string
    grantedAt: Date
    expiresAt: Date | null
    _count: PersonAccessGrantCountAggregateOutputType | null
    _min: PersonAccessGrantMinAggregateOutputType | null
    _max: PersonAccessGrantMaxAggregateOutputType | null
  }

  type GetPersonAccessGrantGroupByPayload<T extends PersonAccessGrantGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonAccessGrantGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonAccessGrantGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonAccessGrantGroupByOutputType[P]>
            : GetScalarType<T[P], PersonAccessGrantGroupByOutputType[P]>
        }
      >
    >


  export type PersonAccessGrantSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    granteeOrgId?: boolean
    grantedAt?: boolean
    expiresAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessGrant"]>

  export type PersonAccessGrantSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    granteeOrgId?: boolean
    grantedAt?: boolean
    expiresAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessGrant"]>

  export type PersonAccessGrantSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    granteeOrgId?: boolean
    grantedAt?: boolean
    expiresAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessGrant"]>

  export type PersonAccessGrantSelectScalar = {
    id?: boolean
    personId?: boolean
    granteeOrgId?: boolean
    grantedAt?: boolean
    expiresAt?: boolean
  }

  export type PersonAccessGrantOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "personId" | "granteeOrgId" | "grantedAt" | "expiresAt", ExtArgs["result"]["personAccessGrant"]>
  export type PersonAccessGrantInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonAccessGrantIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonAccessGrantIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }

  export type $PersonAccessGrantPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PersonAccessGrant"
    objects: {
      person: Prisma.$GlobalNaturalPersonPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      personId: string
      granteeOrgId: string
      grantedAt: Date
      expiresAt: Date | null
    }, ExtArgs["result"]["personAccessGrant"]>
    composites: {}
  }

  type PersonAccessGrantGetPayload<S extends boolean | null | undefined | PersonAccessGrantDefaultArgs> = $Result.GetResult<Prisma.$PersonAccessGrantPayload, S>

  type PersonAccessGrantCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonAccessGrantFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonAccessGrantCountAggregateInputType | true
    }

  export interface PersonAccessGrantDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PersonAccessGrant'], meta: { name: 'PersonAccessGrant' } }
    /**
     * Find zero or one PersonAccessGrant that matches the filter.
     * @param {PersonAccessGrantFindUniqueArgs} args - Arguments to find a PersonAccessGrant
     * @example
     * // Get one PersonAccessGrant
     * const personAccessGrant = await prisma.personAccessGrant.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonAccessGrantFindUniqueArgs>(args: SelectSubset<T, PersonAccessGrantFindUniqueArgs<ExtArgs>>): Prisma__PersonAccessGrantClient<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PersonAccessGrant that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonAccessGrantFindUniqueOrThrowArgs} args - Arguments to find a PersonAccessGrant
     * @example
     * // Get one PersonAccessGrant
     * const personAccessGrant = await prisma.personAccessGrant.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonAccessGrantFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonAccessGrantFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonAccessGrantClient<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonAccessGrant that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessGrantFindFirstArgs} args - Arguments to find a PersonAccessGrant
     * @example
     * // Get one PersonAccessGrant
     * const personAccessGrant = await prisma.personAccessGrant.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonAccessGrantFindFirstArgs>(args?: SelectSubset<T, PersonAccessGrantFindFirstArgs<ExtArgs>>): Prisma__PersonAccessGrantClient<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonAccessGrant that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessGrantFindFirstOrThrowArgs} args - Arguments to find a PersonAccessGrant
     * @example
     * // Get one PersonAccessGrant
     * const personAccessGrant = await prisma.personAccessGrant.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonAccessGrantFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonAccessGrantFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonAccessGrantClient<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PersonAccessGrants that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessGrantFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PersonAccessGrants
     * const personAccessGrants = await prisma.personAccessGrant.findMany()
     * 
     * // Get first 10 PersonAccessGrants
     * const personAccessGrants = await prisma.personAccessGrant.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personAccessGrantWithIdOnly = await prisma.personAccessGrant.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonAccessGrantFindManyArgs>(args?: SelectSubset<T, PersonAccessGrantFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PersonAccessGrant.
     * @param {PersonAccessGrantCreateArgs} args - Arguments to create a PersonAccessGrant.
     * @example
     * // Create one PersonAccessGrant
     * const PersonAccessGrant = await prisma.personAccessGrant.create({
     *   data: {
     *     // ... data to create a PersonAccessGrant
     *   }
     * })
     * 
     */
    create<T extends PersonAccessGrantCreateArgs>(args: SelectSubset<T, PersonAccessGrantCreateArgs<ExtArgs>>): Prisma__PersonAccessGrantClient<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PersonAccessGrants.
     * @param {PersonAccessGrantCreateManyArgs} args - Arguments to create many PersonAccessGrants.
     * @example
     * // Create many PersonAccessGrants
     * const personAccessGrant = await prisma.personAccessGrant.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonAccessGrantCreateManyArgs>(args?: SelectSubset<T, PersonAccessGrantCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PersonAccessGrants and returns the data saved in the database.
     * @param {PersonAccessGrantCreateManyAndReturnArgs} args - Arguments to create many PersonAccessGrants.
     * @example
     * // Create many PersonAccessGrants
     * const personAccessGrant = await prisma.personAccessGrant.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PersonAccessGrants and only return the `id`
     * const personAccessGrantWithIdOnly = await prisma.personAccessGrant.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonAccessGrantCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonAccessGrantCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PersonAccessGrant.
     * @param {PersonAccessGrantDeleteArgs} args - Arguments to delete one PersonAccessGrant.
     * @example
     * // Delete one PersonAccessGrant
     * const PersonAccessGrant = await prisma.personAccessGrant.delete({
     *   where: {
     *     // ... filter to delete one PersonAccessGrant
     *   }
     * })
     * 
     */
    delete<T extends PersonAccessGrantDeleteArgs>(args: SelectSubset<T, PersonAccessGrantDeleteArgs<ExtArgs>>): Prisma__PersonAccessGrantClient<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PersonAccessGrant.
     * @param {PersonAccessGrantUpdateArgs} args - Arguments to update one PersonAccessGrant.
     * @example
     * // Update one PersonAccessGrant
     * const personAccessGrant = await prisma.personAccessGrant.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonAccessGrantUpdateArgs>(args: SelectSubset<T, PersonAccessGrantUpdateArgs<ExtArgs>>): Prisma__PersonAccessGrantClient<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PersonAccessGrants.
     * @param {PersonAccessGrantDeleteManyArgs} args - Arguments to filter PersonAccessGrants to delete.
     * @example
     * // Delete a few PersonAccessGrants
     * const { count } = await prisma.personAccessGrant.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonAccessGrantDeleteManyArgs>(args?: SelectSubset<T, PersonAccessGrantDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonAccessGrants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessGrantUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PersonAccessGrants
     * const personAccessGrant = await prisma.personAccessGrant.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonAccessGrantUpdateManyArgs>(args: SelectSubset<T, PersonAccessGrantUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonAccessGrants and returns the data updated in the database.
     * @param {PersonAccessGrantUpdateManyAndReturnArgs} args - Arguments to update many PersonAccessGrants.
     * @example
     * // Update many PersonAccessGrants
     * const personAccessGrant = await prisma.personAccessGrant.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PersonAccessGrants and only return the `id`
     * const personAccessGrantWithIdOnly = await prisma.personAccessGrant.updateManyAndReturn({
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
    updateManyAndReturn<T extends PersonAccessGrantUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonAccessGrantUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PersonAccessGrant.
     * @param {PersonAccessGrantUpsertArgs} args - Arguments to update or create a PersonAccessGrant.
     * @example
     * // Update or create a PersonAccessGrant
     * const personAccessGrant = await prisma.personAccessGrant.upsert({
     *   create: {
     *     // ... data to create a PersonAccessGrant
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PersonAccessGrant we want to update
     *   }
     * })
     */
    upsert<T extends PersonAccessGrantUpsertArgs>(args: SelectSubset<T, PersonAccessGrantUpsertArgs<ExtArgs>>): Prisma__PersonAccessGrantClient<$Result.GetResult<Prisma.$PersonAccessGrantPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PersonAccessGrants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessGrantCountArgs} args - Arguments to filter PersonAccessGrants to count.
     * @example
     * // Count the number of PersonAccessGrants
     * const count = await prisma.personAccessGrant.count({
     *   where: {
     *     // ... the filter for the PersonAccessGrants we want to count
     *   }
     * })
    **/
    count<T extends PersonAccessGrantCountArgs>(
      args?: Subset<T, PersonAccessGrantCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonAccessGrantCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PersonAccessGrant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessGrantAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PersonAccessGrantAggregateArgs>(args: Subset<T, PersonAccessGrantAggregateArgs>): Prisma.PrismaPromise<GetPersonAccessGrantAggregateType<T>>

    /**
     * Group by PersonAccessGrant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessGrantGroupByArgs} args - Group by arguments.
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
      T extends PersonAccessGrantGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonAccessGrantGroupByArgs['orderBy'] }
        : { orderBy?: PersonAccessGrantGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, PersonAccessGrantGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonAccessGrantGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PersonAccessGrant model
   */
  readonly fields: PersonAccessGrantFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PersonAccessGrant.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonAccessGrantClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    person<T extends GlobalNaturalPersonDefaultArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPersonDefaultArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
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
   * Fields of the PersonAccessGrant model
   */
  interface PersonAccessGrantFieldRefs {
    readonly id: FieldRef<"PersonAccessGrant", 'String'>
    readonly personId: FieldRef<"PersonAccessGrant", 'String'>
    readonly granteeOrgId: FieldRef<"PersonAccessGrant", 'String'>
    readonly grantedAt: FieldRef<"PersonAccessGrant", 'DateTime'>
    readonly expiresAt: FieldRef<"PersonAccessGrant", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PersonAccessGrant findUnique
   */
  export type PersonAccessGrantFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessGrant to fetch.
     */
    where: PersonAccessGrantWhereUniqueInput
  }

  /**
   * PersonAccessGrant findUniqueOrThrow
   */
  export type PersonAccessGrantFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessGrant to fetch.
     */
    where: PersonAccessGrantWhereUniqueInput
  }

  /**
   * PersonAccessGrant findFirst
   */
  export type PersonAccessGrantFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessGrant to fetch.
     */
    where?: PersonAccessGrantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessGrants to fetch.
     */
    orderBy?: PersonAccessGrantOrderByWithRelationInput | PersonAccessGrantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonAccessGrants.
     */
    cursor?: PersonAccessGrantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessGrants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessGrants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessGrants.
     */
    distinct?: PersonAccessGrantScalarFieldEnum | PersonAccessGrantScalarFieldEnum[]
  }

  /**
   * PersonAccessGrant findFirstOrThrow
   */
  export type PersonAccessGrantFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessGrant to fetch.
     */
    where?: PersonAccessGrantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessGrants to fetch.
     */
    orderBy?: PersonAccessGrantOrderByWithRelationInput | PersonAccessGrantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonAccessGrants.
     */
    cursor?: PersonAccessGrantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessGrants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessGrants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessGrants.
     */
    distinct?: PersonAccessGrantScalarFieldEnum | PersonAccessGrantScalarFieldEnum[]
  }

  /**
   * PersonAccessGrant findMany
   */
  export type PersonAccessGrantFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessGrants to fetch.
     */
    where?: PersonAccessGrantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessGrants to fetch.
     */
    orderBy?: PersonAccessGrantOrderByWithRelationInput | PersonAccessGrantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PersonAccessGrants.
     */
    cursor?: PersonAccessGrantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessGrants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessGrants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessGrants.
     */
    distinct?: PersonAccessGrantScalarFieldEnum | PersonAccessGrantScalarFieldEnum[]
  }

  /**
   * PersonAccessGrant create
   */
  export type PersonAccessGrantCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * The data needed to create a PersonAccessGrant.
     */
    data: XOR<PersonAccessGrantCreateInput, PersonAccessGrantUncheckedCreateInput>
  }

  /**
   * PersonAccessGrant createMany
   */
  export type PersonAccessGrantCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PersonAccessGrants.
     */
    data: PersonAccessGrantCreateManyInput | PersonAccessGrantCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PersonAccessGrant createManyAndReturn
   */
  export type PersonAccessGrantCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * The data used to create many PersonAccessGrants.
     */
    data: PersonAccessGrantCreateManyInput | PersonAccessGrantCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonAccessGrant update
   */
  export type PersonAccessGrantUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * The data needed to update a PersonAccessGrant.
     */
    data: XOR<PersonAccessGrantUpdateInput, PersonAccessGrantUncheckedUpdateInput>
    /**
     * Choose, which PersonAccessGrant to update.
     */
    where: PersonAccessGrantWhereUniqueInput
  }

  /**
   * PersonAccessGrant updateMany
   */
  export type PersonAccessGrantUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PersonAccessGrants.
     */
    data: XOR<PersonAccessGrantUpdateManyMutationInput, PersonAccessGrantUncheckedUpdateManyInput>
    /**
     * Filter which PersonAccessGrants to update
     */
    where?: PersonAccessGrantWhereInput
    /**
     * Limit how many PersonAccessGrants to update.
     */
    limit?: number
  }

  /**
   * PersonAccessGrant updateManyAndReturn
   */
  export type PersonAccessGrantUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * The data used to update PersonAccessGrants.
     */
    data: XOR<PersonAccessGrantUpdateManyMutationInput, PersonAccessGrantUncheckedUpdateManyInput>
    /**
     * Filter which PersonAccessGrants to update
     */
    where?: PersonAccessGrantWhereInput
    /**
     * Limit how many PersonAccessGrants to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonAccessGrant upsert
   */
  export type PersonAccessGrantUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * The filter to search for the PersonAccessGrant to update in case it exists.
     */
    where: PersonAccessGrantWhereUniqueInput
    /**
     * In case the PersonAccessGrant found by the `where` argument doesn't exist, create a new PersonAccessGrant with this data.
     */
    create: XOR<PersonAccessGrantCreateInput, PersonAccessGrantUncheckedCreateInput>
    /**
     * In case the PersonAccessGrant was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonAccessGrantUpdateInput, PersonAccessGrantUncheckedUpdateInput>
  }

  /**
   * PersonAccessGrant delete
   */
  export type PersonAccessGrantDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
    /**
     * Filter which PersonAccessGrant to delete.
     */
    where: PersonAccessGrantWhereUniqueInput
  }

  /**
   * PersonAccessGrant deleteMany
   */
  export type PersonAccessGrantDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonAccessGrants to delete
     */
    where?: PersonAccessGrantWhereInput
    /**
     * Limit how many PersonAccessGrants to delete.
     */
    limit?: number
  }

  /**
   * PersonAccessGrant without action
   */
  export type PersonAccessGrantDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessGrant
     */
    select?: PersonAccessGrantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessGrant
     */
    omit?: PersonAccessGrantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessGrantInclude<ExtArgs> | null
  }


  /**
   * Model PersonAccessLog
   */

  export type AggregatePersonAccessLog = {
    _count: PersonAccessLogCountAggregateOutputType | null
    _min: PersonAccessLogMinAggregateOutputType | null
    _max: PersonAccessLogMaxAggregateOutputType | null
  }

  export type PersonAccessLogMinAggregateOutputType = {
    id: string | null
    personId: string | null
    actorOrgId: string | null
    action: string | null
    metaJson: string | null
    createdAt: Date | null
  }

  export type PersonAccessLogMaxAggregateOutputType = {
    id: string | null
    personId: string | null
    actorOrgId: string | null
    action: string | null
    metaJson: string | null
    createdAt: Date | null
  }

  export type PersonAccessLogCountAggregateOutputType = {
    id: number
    personId: number
    actorOrgId: number
    action: number
    metaJson: number
    createdAt: number
    _all: number
  }


  export type PersonAccessLogMinAggregateInputType = {
    id?: true
    personId?: true
    actorOrgId?: true
    action?: true
    metaJson?: true
    createdAt?: true
  }

  export type PersonAccessLogMaxAggregateInputType = {
    id?: true
    personId?: true
    actorOrgId?: true
    action?: true
    metaJson?: true
    createdAt?: true
  }

  export type PersonAccessLogCountAggregateInputType = {
    id?: true
    personId?: true
    actorOrgId?: true
    action?: true
    metaJson?: true
    createdAt?: true
    _all?: true
  }

  export type PersonAccessLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonAccessLog to aggregate.
     */
    where?: PersonAccessLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessLogs to fetch.
     */
    orderBy?: PersonAccessLogOrderByWithRelationInput | PersonAccessLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonAccessLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PersonAccessLogs
    **/
    _count?: true | PersonAccessLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonAccessLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonAccessLogMaxAggregateInputType
  }

  export type GetPersonAccessLogAggregateType<T extends PersonAccessLogAggregateArgs> = {
        [P in keyof T & keyof AggregatePersonAccessLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersonAccessLog[P]>
      : GetScalarType<T[P], AggregatePersonAccessLog[P]>
  }




  export type PersonAccessLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonAccessLogWhereInput
    orderBy?: PersonAccessLogOrderByWithAggregationInput | PersonAccessLogOrderByWithAggregationInput[]
    by: PersonAccessLogScalarFieldEnum[] | PersonAccessLogScalarFieldEnum
    having?: PersonAccessLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonAccessLogCountAggregateInputType | true
    _min?: PersonAccessLogMinAggregateInputType
    _max?: PersonAccessLogMaxAggregateInputType
  }

  export type PersonAccessLogGroupByOutputType = {
    id: string
    personId: string
    actorOrgId: string
    action: string
    metaJson: string | null
    createdAt: Date
    _count: PersonAccessLogCountAggregateOutputType | null
    _min: PersonAccessLogMinAggregateOutputType | null
    _max: PersonAccessLogMaxAggregateOutputType | null
  }

  type GetPersonAccessLogGroupByPayload<T extends PersonAccessLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonAccessLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonAccessLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonAccessLogGroupByOutputType[P]>
            : GetScalarType<T[P], PersonAccessLogGroupByOutputType[P]>
        }
      >
    >


  export type PersonAccessLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    actorOrgId?: boolean
    action?: boolean
    metaJson?: boolean
    createdAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessLog"]>

  export type PersonAccessLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    actorOrgId?: boolean
    action?: boolean
    metaJson?: boolean
    createdAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessLog"]>

  export type PersonAccessLogSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personId?: boolean
    actorOrgId?: boolean
    action?: boolean
    metaJson?: boolean
    createdAt?: boolean
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personAccessLog"]>

  export type PersonAccessLogSelectScalar = {
    id?: boolean
    personId?: boolean
    actorOrgId?: boolean
    action?: boolean
    metaJson?: boolean
    createdAt?: boolean
  }

  export type PersonAccessLogOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "personId" | "actorOrgId" | "action" | "metaJson" | "createdAt", ExtArgs["result"]["personAccessLog"]>
  export type PersonAccessLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonAccessLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }
  export type PersonAccessLogIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    person?: boolean | GlobalNaturalPersonDefaultArgs<ExtArgs>
  }

  export type $PersonAccessLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PersonAccessLog"
    objects: {
      person: Prisma.$GlobalNaturalPersonPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      personId: string
      actorOrgId: string
      action: string
      metaJson: string | null
      createdAt: Date
    }, ExtArgs["result"]["personAccessLog"]>
    composites: {}
  }

  type PersonAccessLogGetPayload<S extends boolean | null | undefined | PersonAccessLogDefaultArgs> = $Result.GetResult<Prisma.$PersonAccessLogPayload, S>

  type PersonAccessLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonAccessLogFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonAccessLogCountAggregateInputType | true
    }

  export interface PersonAccessLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PersonAccessLog'], meta: { name: 'PersonAccessLog' } }
    /**
     * Find zero or one PersonAccessLog that matches the filter.
     * @param {PersonAccessLogFindUniqueArgs} args - Arguments to find a PersonAccessLog
     * @example
     * // Get one PersonAccessLog
     * const personAccessLog = await prisma.personAccessLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonAccessLogFindUniqueArgs>(args: SelectSubset<T, PersonAccessLogFindUniqueArgs<ExtArgs>>): Prisma__PersonAccessLogClient<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PersonAccessLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonAccessLogFindUniqueOrThrowArgs} args - Arguments to find a PersonAccessLog
     * @example
     * // Get one PersonAccessLog
     * const personAccessLog = await prisma.personAccessLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonAccessLogFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonAccessLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonAccessLogClient<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonAccessLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessLogFindFirstArgs} args - Arguments to find a PersonAccessLog
     * @example
     * // Get one PersonAccessLog
     * const personAccessLog = await prisma.personAccessLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonAccessLogFindFirstArgs>(args?: SelectSubset<T, PersonAccessLogFindFirstArgs<ExtArgs>>): Prisma__PersonAccessLogClient<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonAccessLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessLogFindFirstOrThrowArgs} args - Arguments to find a PersonAccessLog
     * @example
     * // Get one PersonAccessLog
     * const personAccessLog = await prisma.personAccessLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonAccessLogFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonAccessLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonAccessLogClient<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PersonAccessLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PersonAccessLogs
     * const personAccessLogs = await prisma.personAccessLog.findMany()
     * 
     * // Get first 10 PersonAccessLogs
     * const personAccessLogs = await prisma.personAccessLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personAccessLogWithIdOnly = await prisma.personAccessLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonAccessLogFindManyArgs>(args?: SelectSubset<T, PersonAccessLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PersonAccessLog.
     * @param {PersonAccessLogCreateArgs} args - Arguments to create a PersonAccessLog.
     * @example
     * // Create one PersonAccessLog
     * const PersonAccessLog = await prisma.personAccessLog.create({
     *   data: {
     *     // ... data to create a PersonAccessLog
     *   }
     * })
     * 
     */
    create<T extends PersonAccessLogCreateArgs>(args: SelectSubset<T, PersonAccessLogCreateArgs<ExtArgs>>): Prisma__PersonAccessLogClient<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PersonAccessLogs.
     * @param {PersonAccessLogCreateManyArgs} args - Arguments to create many PersonAccessLogs.
     * @example
     * // Create many PersonAccessLogs
     * const personAccessLog = await prisma.personAccessLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonAccessLogCreateManyArgs>(args?: SelectSubset<T, PersonAccessLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PersonAccessLogs and returns the data saved in the database.
     * @param {PersonAccessLogCreateManyAndReturnArgs} args - Arguments to create many PersonAccessLogs.
     * @example
     * // Create many PersonAccessLogs
     * const personAccessLog = await prisma.personAccessLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PersonAccessLogs and only return the `id`
     * const personAccessLogWithIdOnly = await prisma.personAccessLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonAccessLogCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonAccessLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PersonAccessLog.
     * @param {PersonAccessLogDeleteArgs} args - Arguments to delete one PersonAccessLog.
     * @example
     * // Delete one PersonAccessLog
     * const PersonAccessLog = await prisma.personAccessLog.delete({
     *   where: {
     *     // ... filter to delete one PersonAccessLog
     *   }
     * })
     * 
     */
    delete<T extends PersonAccessLogDeleteArgs>(args: SelectSubset<T, PersonAccessLogDeleteArgs<ExtArgs>>): Prisma__PersonAccessLogClient<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PersonAccessLog.
     * @param {PersonAccessLogUpdateArgs} args - Arguments to update one PersonAccessLog.
     * @example
     * // Update one PersonAccessLog
     * const personAccessLog = await prisma.personAccessLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonAccessLogUpdateArgs>(args: SelectSubset<T, PersonAccessLogUpdateArgs<ExtArgs>>): Prisma__PersonAccessLogClient<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PersonAccessLogs.
     * @param {PersonAccessLogDeleteManyArgs} args - Arguments to filter PersonAccessLogs to delete.
     * @example
     * // Delete a few PersonAccessLogs
     * const { count } = await prisma.personAccessLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonAccessLogDeleteManyArgs>(args?: SelectSubset<T, PersonAccessLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonAccessLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PersonAccessLogs
     * const personAccessLog = await prisma.personAccessLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonAccessLogUpdateManyArgs>(args: SelectSubset<T, PersonAccessLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonAccessLogs and returns the data updated in the database.
     * @param {PersonAccessLogUpdateManyAndReturnArgs} args - Arguments to update many PersonAccessLogs.
     * @example
     * // Update many PersonAccessLogs
     * const personAccessLog = await prisma.personAccessLog.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PersonAccessLogs and only return the `id`
     * const personAccessLogWithIdOnly = await prisma.personAccessLog.updateManyAndReturn({
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
    updateManyAndReturn<T extends PersonAccessLogUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonAccessLogUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PersonAccessLog.
     * @param {PersonAccessLogUpsertArgs} args - Arguments to update or create a PersonAccessLog.
     * @example
     * // Update or create a PersonAccessLog
     * const personAccessLog = await prisma.personAccessLog.upsert({
     *   create: {
     *     // ... data to create a PersonAccessLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PersonAccessLog we want to update
     *   }
     * })
     */
    upsert<T extends PersonAccessLogUpsertArgs>(args: SelectSubset<T, PersonAccessLogUpsertArgs<ExtArgs>>): Prisma__PersonAccessLogClient<$Result.GetResult<Prisma.$PersonAccessLogPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PersonAccessLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessLogCountArgs} args - Arguments to filter PersonAccessLogs to count.
     * @example
     * // Count the number of PersonAccessLogs
     * const count = await prisma.personAccessLog.count({
     *   where: {
     *     // ... the filter for the PersonAccessLogs we want to count
     *   }
     * })
    **/
    count<T extends PersonAccessLogCountArgs>(
      args?: Subset<T, PersonAccessLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonAccessLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PersonAccessLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PersonAccessLogAggregateArgs>(args: Subset<T, PersonAccessLogAggregateArgs>): Prisma.PrismaPromise<GetPersonAccessLogAggregateType<T>>

    /**
     * Group by PersonAccessLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonAccessLogGroupByArgs} args - Group by arguments.
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
      T extends PersonAccessLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonAccessLogGroupByArgs['orderBy'] }
        : { orderBy?: PersonAccessLogGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, PersonAccessLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonAccessLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PersonAccessLog model
   */
  readonly fields: PersonAccessLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PersonAccessLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonAccessLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    person<T extends GlobalNaturalPersonDefaultArgs<ExtArgs> = {}>(args?: Subset<T, GlobalNaturalPersonDefaultArgs<ExtArgs>>): Prisma__GlobalNaturalPersonClient<$Result.GetResult<Prisma.$GlobalNaturalPersonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
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
   * Fields of the PersonAccessLog model
   */
  interface PersonAccessLogFieldRefs {
    readonly id: FieldRef<"PersonAccessLog", 'String'>
    readonly personId: FieldRef<"PersonAccessLog", 'String'>
    readonly actorOrgId: FieldRef<"PersonAccessLog", 'String'>
    readonly action: FieldRef<"PersonAccessLog", 'String'>
    readonly metaJson: FieldRef<"PersonAccessLog", 'String'>
    readonly createdAt: FieldRef<"PersonAccessLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PersonAccessLog findUnique
   */
  export type PersonAccessLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessLog to fetch.
     */
    where: PersonAccessLogWhereUniqueInput
  }

  /**
   * PersonAccessLog findUniqueOrThrow
   */
  export type PersonAccessLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessLog to fetch.
     */
    where: PersonAccessLogWhereUniqueInput
  }

  /**
   * PersonAccessLog findFirst
   */
  export type PersonAccessLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessLog to fetch.
     */
    where?: PersonAccessLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessLogs to fetch.
     */
    orderBy?: PersonAccessLogOrderByWithRelationInput | PersonAccessLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonAccessLogs.
     */
    cursor?: PersonAccessLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessLogs.
     */
    distinct?: PersonAccessLogScalarFieldEnum | PersonAccessLogScalarFieldEnum[]
  }

  /**
   * PersonAccessLog findFirstOrThrow
   */
  export type PersonAccessLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessLog to fetch.
     */
    where?: PersonAccessLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessLogs to fetch.
     */
    orderBy?: PersonAccessLogOrderByWithRelationInput | PersonAccessLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonAccessLogs.
     */
    cursor?: PersonAccessLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessLogs.
     */
    distinct?: PersonAccessLogScalarFieldEnum | PersonAccessLogScalarFieldEnum[]
  }

  /**
   * PersonAccessLog findMany
   */
  export type PersonAccessLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which PersonAccessLogs to fetch.
     */
    where?: PersonAccessLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonAccessLogs to fetch.
     */
    orderBy?: PersonAccessLogOrderByWithRelationInput | PersonAccessLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PersonAccessLogs.
     */
    cursor?: PersonAccessLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonAccessLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonAccessLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonAccessLogs.
     */
    distinct?: PersonAccessLogScalarFieldEnum | PersonAccessLogScalarFieldEnum[]
  }

  /**
   * PersonAccessLog create
   */
  export type PersonAccessLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * The data needed to create a PersonAccessLog.
     */
    data: XOR<PersonAccessLogCreateInput, PersonAccessLogUncheckedCreateInput>
  }

  /**
   * PersonAccessLog createMany
   */
  export type PersonAccessLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PersonAccessLogs.
     */
    data: PersonAccessLogCreateManyInput | PersonAccessLogCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PersonAccessLog createManyAndReturn
   */
  export type PersonAccessLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * The data used to create many PersonAccessLogs.
     */
    data: PersonAccessLogCreateManyInput | PersonAccessLogCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonAccessLog update
   */
  export type PersonAccessLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * The data needed to update a PersonAccessLog.
     */
    data: XOR<PersonAccessLogUpdateInput, PersonAccessLogUncheckedUpdateInput>
    /**
     * Choose, which PersonAccessLog to update.
     */
    where: PersonAccessLogWhereUniqueInput
  }

  /**
   * PersonAccessLog updateMany
   */
  export type PersonAccessLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PersonAccessLogs.
     */
    data: XOR<PersonAccessLogUpdateManyMutationInput, PersonAccessLogUncheckedUpdateManyInput>
    /**
     * Filter which PersonAccessLogs to update
     */
    where?: PersonAccessLogWhereInput
    /**
     * Limit how many PersonAccessLogs to update.
     */
    limit?: number
  }

  /**
   * PersonAccessLog updateManyAndReturn
   */
  export type PersonAccessLogUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * The data used to update PersonAccessLogs.
     */
    data: XOR<PersonAccessLogUpdateManyMutationInput, PersonAccessLogUncheckedUpdateManyInput>
    /**
     * Filter which PersonAccessLogs to update
     */
    where?: PersonAccessLogWhereInput
    /**
     * Limit how many PersonAccessLogs to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonAccessLog upsert
   */
  export type PersonAccessLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * The filter to search for the PersonAccessLog to update in case it exists.
     */
    where: PersonAccessLogWhereUniqueInput
    /**
     * In case the PersonAccessLog found by the `where` argument doesn't exist, create a new PersonAccessLog with this data.
     */
    create: XOR<PersonAccessLogCreateInput, PersonAccessLogUncheckedCreateInput>
    /**
     * In case the PersonAccessLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonAccessLogUpdateInput, PersonAccessLogUncheckedUpdateInput>
  }

  /**
   * PersonAccessLog delete
   */
  export type PersonAccessLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
    /**
     * Filter which PersonAccessLog to delete.
     */
    where: PersonAccessLogWhereUniqueInput
  }

  /**
   * PersonAccessLog deleteMany
   */
  export type PersonAccessLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonAccessLogs to delete
     */
    where?: PersonAccessLogWhereInput
    /**
     * Limit how many PersonAccessLogs to delete.
     */
    limit?: number
  }

  /**
   * PersonAccessLog without action
   */
  export type PersonAccessLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonAccessLog
     */
    select?: PersonAccessLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonAccessLog
     */
    omit?: PersonAccessLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonAccessLogInclude<ExtArgs> | null
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


  export const GlobalNaturalPersonScalarFieldEnum: {
    id: 'id',
    finBlindIndex: 'finBlindIndex',
    finCipher: 'finCipher',
    firstNameCipher: 'firstNameCipher',
    middleNameCipher: 'middleNameCipher',
    lastNameCipher: 'lastNameCipher',
    fullNameCipher: 'fullNameCipher',
    phoneCipher: 'phoneCipher',
    nationality: 'nationality',
    sex: 'sex',
    birthDate: 'birthDate',
    personSegment: 'personSegment',
    mergedIntoPersonId: 'mergedIntoPersonId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type GlobalNaturalPersonScalarFieldEnum = (typeof GlobalNaturalPersonScalarFieldEnum)[keyof typeof GlobalNaturalPersonScalarFieldEnum]


  export const PersonHrProfileScalarFieldEnum: {
    id: 'id',
    personId: 'personId',
    bloodGroup: 'bloodGroup',
    maritalStatus: 'maritalStatus',
    educationCipher: 'educationCipher',
    specialtyCipher: 'specialtyCipher',
    statisticalCategories: 'statisticalCategories',
    photoStorageKey: 'photoStorageKey',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type PersonHrProfileScalarFieldEnum = (typeof PersonHrProfileScalarFieldEnum)[keyof typeof PersonHrProfileScalarFieldEnum]


  export const PersonAddressScalarFieldEnum: {
    id: 'id',
    personId: 'personId',
    kind: 'kind',
    lineCipher: 'lineCipher',
    cityCipher: 'cityCipher',
    regionCipher: 'regionCipher',
    postalCipher: 'postalCipher',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type PersonAddressScalarFieldEnum = (typeof PersonAddressScalarFieldEnum)[keyof typeof PersonAddressScalarFieldEnum]


  export const PersonIdentifierScalarFieldEnum: {
    id: 'id',
    personId: 'personId',
    type: 'type',
    issuingCountry: 'issuingCountry',
    valueCipher: 'valueCipher',
    blindIndex: 'blindIndex',
    trust: 'trust',
    isPrimary: 'isPrimary',
    createdAt: 'createdAt'
  };

  export type PersonIdentifierScalarFieldEnum = (typeof PersonIdentifierScalarFieldEnum)[keyof typeof PersonIdentifierScalarFieldEnum]


  export const GlobalLegalEntityScalarFieldEnum: {
    id: 'id',
    taxIdBlindIndex: 'taxIdBlindIndex',
    taxIdCipher: 'taxIdCipher',
    nameCipher: 'nameCipher',
    organizationId: 'organizationId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type GlobalLegalEntityScalarFieldEnum = (typeof GlobalLegalEntityScalarFieldEnum)[keyof typeof GlobalLegalEntityScalarFieldEnum]


  export const PersonAccessRequestScalarFieldEnum: {
    id: 'id',
    personId: 'personId',
    requesterOrgId: 'requesterOrgId',
    purpose: 'purpose',
    status: 'status',
    createdAt: 'createdAt',
    decidedAt: 'decidedAt'
  };

  export type PersonAccessRequestScalarFieldEnum = (typeof PersonAccessRequestScalarFieldEnum)[keyof typeof PersonAccessRequestScalarFieldEnum]


  export const PersonAccessGrantScalarFieldEnum: {
    id: 'id',
    personId: 'personId',
    granteeOrgId: 'granteeOrgId',
    grantedAt: 'grantedAt',
    expiresAt: 'expiresAt'
  };

  export type PersonAccessGrantScalarFieldEnum = (typeof PersonAccessGrantScalarFieldEnum)[keyof typeof PersonAccessGrantScalarFieldEnum]


  export const PersonAccessLogScalarFieldEnum: {
    id: 'id',
    personId: 'personId',
    actorOrgId: 'actorOrgId',
    action: 'action',
    metaJson: 'metaJson',
    createdAt: 'createdAt'
  };

  export type PersonAccessLogScalarFieldEnum = (typeof PersonAccessLogScalarFieldEnum)[keyof typeof PersonAccessLogScalarFieldEnum]


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
   * Reference to a field of type 'PersonSex'
   */
  export type EnumPersonSexFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonSex'>
    


  /**
   * Reference to a field of type 'PersonSex[]'
   */
  export type ListEnumPersonSexFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonSex[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'PersonSegment'
   */
  export type EnumPersonSegmentFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonSegment'>
    


  /**
   * Reference to a field of type 'PersonSegment[]'
   */
  export type ListEnumPersonSegmentFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonSegment[]'>
    


  /**
   * Reference to a field of type 'BloodGroup'
   */
  export type EnumBloodGroupFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BloodGroup'>
    


  /**
   * Reference to a field of type 'BloodGroup[]'
   */
  export type ListEnumBloodGroupFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BloodGroup[]'>
    


  /**
   * Reference to a field of type 'MaritalStatus'
   */
  export type EnumMaritalStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'MaritalStatus'>
    


  /**
   * Reference to a field of type 'MaritalStatus[]'
   */
  export type ListEnumMaritalStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'MaritalStatus[]'>
    


  /**
   * Reference to a field of type 'StatisticalCategory[]'
   */
  export type ListEnumStatisticalCategoryFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'StatisticalCategory[]'>
    


  /**
   * Reference to a field of type 'StatisticalCategory'
   */
  export type EnumStatisticalCategoryFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'StatisticalCategory'>
    


  /**
   * Reference to a field of type 'PersonAddressKind'
   */
  export type EnumPersonAddressKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonAddressKind'>
    


  /**
   * Reference to a field of type 'PersonAddressKind[]'
   */
  export type ListEnumPersonAddressKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonAddressKind[]'>
    


  /**
   * Reference to a field of type 'PersonIdentifierType'
   */
  export type EnumPersonIdentifierTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonIdentifierType'>
    


  /**
   * Reference to a field of type 'PersonIdentifierType[]'
   */
  export type ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonIdentifierType[]'>
    


  /**
   * Reference to a field of type 'IdentifierTrust'
   */
  export type EnumIdentifierTrustFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'IdentifierTrust'>
    


  /**
   * Reference to a field of type 'IdentifierTrust[]'
   */
  export type ListEnumIdentifierTrustFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'IdentifierTrust[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'PersonAccessRequestStatus'
   */
  export type EnumPersonAccessRequestStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonAccessRequestStatus'>
    


  /**
   * Reference to a field of type 'PersonAccessRequestStatus[]'
   */
  export type ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PersonAccessRequestStatus[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type GlobalNaturalPersonWhereInput = {
    AND?: GlobalNaturalPersonWhereInput | GlobalNaturalPersonWhereInput[]
    OR?: GlobalNaturalPersonWhereInput[]
    NOT?: GlobalNaturalPersonWhereInput | GlobalNaturalPersonWhereInput[]
    id?: UuidFilter<"GlobalNaturalPerson"> | string
    finBlindIndex?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    finCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    firstNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    middleNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    lastNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    fullNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    phoneCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    nationality?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    sex?: EnumPersonSexFilter<"GlobalNaturalPerson"> | $Enums.PersonSex
    birthDate?: DateTimeNullableFilter<"GlobalNaturalPerson"> | Date | string | null
    personSegment?: EnumPersonSegmentFilter<"GlobalNaturalPerson"> | $Enums.PersonSegment
    mergedIntoPersonId?: UuidNullableFilter<"GlobalNaturalPerson"> | string | null
    createdAt?: DateTimeFilter<"GlobalNaturalPerson"> | Date | string
    updatedAt?: DateTimeFilter<"GlobalNaturalPerson"> | Date | string
    identifiers?: PersonIdentifierListRelationFilter
    accessRequests?: PersonAccessRequestListRelationFilter
    accessGrants?: PersonAccessGrantListRelationFilter
    accessLogs?: PersonAccessLogListRelationFilter
    hrProfile?: XOR<PersonHrProfileNullableScalarRelationFilter, PersonHrProfileWhereInput> | null
    addresses?: PersonAddressListRelationFilter
    mergedInto?: XOR<GlobalNaturalPersonNullableScalarRelationFilter, GlobalNaturalPersonWhereInput> | null
    mergedFrom?: GlobalNaturalPersonListRelationFilter
  }

  export type GlobalNaturalPersonOrderByWithRelationInput = {
    id?: SortOrder
    finBlindIndex?: SortOrderInput | SortOrder
    finCipher?: SortOrderInput | SortOrder
    firstNameCipher?: SortOrderInput | SortOrder
    middleNameCipher?: SortOrderInput | SortOrder
    lastNameCipher?: SortOrderInput | SortOrder
    fullNameCipher?: SortOrderInput | SortOrder
    phoneCipher?: SortOrderInput | SortOrder
    nationality?: SortOrderInput | SortOrder
    sex?: SortOrder
    birthDate?: SortOrderInput | SortOrder
    personSegment?: SortOrder
    mergedIntoPersonId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    identifiers?: PersonIdentifierOrderByRelationAggregateInput
    accessRequests?: PersonAccessRequestOrderByRelationAggregateInput
    accessGrants?: PersonAccessGrantOrderByRelationAggregateInput
    accessLogs?: PersonAccessLogOrderByRelationAggregateInput
    hrProfile?: PersonHrProfileOrderByWithRelationInput
    addresses?: PersonAddressOrderByRelationAggregateInput
    mergedInto?: GlobalNaturalPersonOrderByWithRelationInput
    mergedFrom?: GlobalNaturalPersonOrderByRelationAggregateInput
  }

  export type GlobalNaturalPersonWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    finBlindIndex?: string
    AND?: GlobalNaturalPersonWhereInput | GlobalNaturalPersonWhereInput[]
    OR?: GlobalNaturalPersonWhereInput[]
    NOT?: GlobalNaturalPersonWhereInput | GlobalNaturalPersonWhereInput[]
    finCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    firstNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    middleNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    lastNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    fullNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    phoneCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    nationality?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    sex?: EnumPersonSexFilter<"GlobalNaturalPerson"> | $Enums.PersonSex
    birthDate?: DateTimeNullableFilter<"GlobalNaturalPerson"> | Date | string | null
    personSegment?: EnumPersonSegmentFilter<"GlobalNaturalPerson"> | $Enums.PersonSegment
    mergedIntoPersonId?: UuidNullableFilter<"GlobalNaturalPerson"> | string | null
    createdAt?: DateTimeFilter<"GlobalNaturalPerson"> | Date | string
    updatedAt?: DateTimeFilter<"GlobalNaturalPerson"> | Date | string
    identifiers?: PersonIdentifierListRelationFilter
    accessRequests?: PersonAccessRequestListRelationFilter
    accessGrants?: PersonAccessGrantListRelationFilter
    accessLogs?: PersonAccessLogListRelationFilter
    hrProfile?: XOR<PersonHrProfileNullableScalarRelationFilter, PersonHrProfileWhereInput> | null
    addresses?: PersonAddressListRelationFilter
    mergedInto?: XOR<GlobalNaturalPersonNullableScalarRelationFilter, GlobalNaturalPersonWhereInput> | null
    mergedFrom?: GlobalNaturalPersonListRelationFilter
  }, "id" | "finBlindIndex">

  export type GlobalNaturalPersonOrderByWithAggregationInput = {
    id?: SortOrder
    finBlindIndex?: SortOrderInput | SortOrder
    finCipher?: SortOrderInput | SortOrder
    firstNameCipher?: SortOrderInput | SortOrder
    middleNameCipher?: SortOrderInput | SortOrder
    lastNameCipher?: SortOrderInput | SortOrder
    fullNameCipher?: SortOrderInput | SortOrder
    phoneCipher?: SortOrderInput | SortOrder
    nationality?: SortOrderInput | SortOrder
    sex?: SortOrder
    birthDate?: SortOrderInput | SortOrder
    personSegment?: SortOrder
    mergedIntoPersonId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: GlobalNaturalPersonCountOrderByAggregateInput
    _max?: GlobalNaturalPersonMaxOrderByAggregateInput
    _min?: GlobalNaturalPersonMinOrderByAggregateInput
  }

  export type GlobalNaturalPersonScalarWhereWithAggregatesInput = {
    AND?: GlobalNaturalPersonScalarWhereWithAggregatesInput | GlobalNaturalPersonScalarWhereWithAggregatesInput[]
    OR?: GlobalNaturalPersonScalarWhereWithAggregatesInput[]
    NOT?: GlobalNaturalPersonScalarWhereWithAggregatesInput | GlobalNaturalPersonScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"GlobalNaturalPerson"> | string
    finBlindIndex?: StringNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    finCipher?: StringNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    firstNameCipher?: StringNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    middleNameCipher?: StringNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    lastNameCipher?: StringNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    fullNameCipher?: StringNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    phoneCipher?: StringNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    nationality?: StringNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    sex?: EnumPersonSexWithAggregatesFilter<"GlobalNaturalPerson"> | $Enums.PersonSex
    birthDate?: DateTimeNullableWithAggregatesFilter<"GlobalNaturalPerson"> | Date | string | null
    personSegment?: EnumPersonSegmentWithAggregatesFilter<"GlobalNaturalPerson"> | $Enums.PersonSegment
    mergedIntoPersonId?: UuidNullableWithAggregatesFilter<"GlobalNaturalPerson"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"GlobalNaturalPerson"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"GlobalNaturalPerson"> | Date | string
  }

  export type PersonHrProfileWhereInput = {
    AND?: PersonHrProfileWhereInput | PersonHrProfileWhereInput[]
    OR?: PersonHrProfileWhereInput[]
    NOT?: PersonHrProfileWhereInput | PersonHrProfileWhereInput[]
    id?: UuidFilter<"PersonHrProfile"> | string
    personId?: UuidFilter<"PersonHrProfile"> | string
    bloodGroup?: EnumBloodGroupFilter<"PersonHrProfile"> | $Enums.BloodGroup
    maritalStatus?: EnumMaritalStatusNullableFilter<"PersonHrProfile"> | $Enums.MaritalStatus | null
    educationCipher?: StringNullableFilter<"PersonHrProfile"> | string | null
    specialtyCipher?: StringNullableFilter<"PersonHrProfile"> | string | null
    statisticalCategories?: EnumStatisticalCategoryNullableListFilter<"PersonHrProfile">
    photoStorageKey?: StringNullableFilter<"PersonHrProfile"> | string | null
    createdAt?: DateTimeFilter<"PersonHrProfile"> | Date | string
    updatedAt?: DateTimeFilter<"PersonHrProfile"> | Date | string
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }

  export type PersonHrProfileOrderByWithRelationInput = {
    id?: SortOrder
    personId?: SortOrder
    bloodGroup?: SortOrder
    maritalStatus?: SortOrderInput | SortOrder
    educationCipher?: SortOrderInput | SortOrder
    specialtyCipher?: SortOrderInput | SortOrder
    statisticalCategories?: SortOrder
    photoStorageKey?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    person?: GlobalNaturalPersonOrderByWithRelationInput
  }

  export type PersonHrProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    personId?: string
    AND?: PersonHrProfileWhereInput | PersonHrProfileWhereInput[]
    OR?: PersonHrProfileWhereInput[]
    NOT?: PersonHrProfileWhereInput | PersonHrProfileWhereInput[]
    bloodGroup?: EnumBloodGroupFilter<"PersonHrProfile"> | $Enums.BloodGroup
    maritalStatus?: EnumMaritalStatusNullableFilter<"PersonHrProfile"> | $Enums.MaritalStatus | null
    educationCipher?: StringNullableFilter<"PersonHrProfile"> | string | null
    specialtyCipher?: StringNullableFilter<"PersonHrProfile"> | string | null
    statisticalCategories?: EnumStatisticalCategoryNullableListFilter<"PersonHrProfile">
    photoStorageKey?: StringNullableFilter<"PersonHrProfile"> | string | null
    createdAt?: DateTimeFilter<"PersonHrProfile"> | Date | string
    updatedAt?: DateTimeFilter<"PersonHrProfile"> | Date | string
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }, "id" | "personId">

  export type PersonHrProfileOrderByWithAggregationInput = {
    id?: SortOrder
    personId?: SortOrder
    bloodGroup?: SortOrder
    maritalStatus?: SortOrderInput | SortOrder
    educationCipher?: SortOrderInput | SortOrder
    specialtyCipher?: SortOrderInput | SortOrder
    statisticalCategories?: SortOrder
    photoStorageKey?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PersonHrProfileCountOrderByAggregateInput
    _max?: PersonHrProfileMaxOrderByAggregateInput
    _min?: PersonHrProfileMinOrderByAggregateInput
  }

  export type PersonHrProfileScalarWhereWithAggregatesInput = {
    AND?: PersonHrProfileScalarWhereWithAggregatesInput | PersonHrProfileScalarWhereWithAggregatesInput[]
    OR?: PersonHrProfileScalarWhereWithAggregatesInput[]
    NOT?: PersonHrProfileScalarWhereWithAggregatesInput | PersonHrProfileScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"PersonHrProfile"> | string
    personId?: UuidWithAggregatesFilter<"PersonHrProfile"> | string
    bloodGroup?: EnumBloodGroupWithAggregatesFilter<"PersonHrProfile"> | $Enums.BloodGroup
    maritalStatus?: EnumMaritalStatusNullableWithAggregatesFilter<"PersonHrProfile"> | $Enums.MaritalStatus | null
    educationCipher?: StringNullableWithAggregatesFilter<"PersonHrProfile"> | string | null
    specialtyCipher?: StringNullableWithAggregatesFilter<"PersonHrProfile"> | string | null
    statisticalCategories?: EnumStatisticalCategoryNullableListFilter<"PersonHrProfile">
    photoStorageKey?: StringNullableWithAggregatesFilter<"PersonHrProfile"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PersonHrProfile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PersonHrProfile"> | Date | string
  }

  export type PersonAddressWhereInput = {
    AND?: PersonAddressWhereInput | PersonAddressWhereInput[]
    OR?: PersonAddressWhereInput[]
    NOT?: PersonAddressWhereInput | PersonAddressWhereInput[]
    id?: UuidFilter<"PersonAddress"> | string
    personId?: UuidFilter<"PersonAddress"> | string
    kind?: EnumPersonAddressKindFilter<"PersonAddress"> | $Enums.PersonAddressKind
    lineCipher?: StringFilter<"PersonAddress"> | string
    cityCipher?: StringNullableFilter<"PersonAddress"> | string | null
    regionCipher?: StringNullableFilter<"PersonAddress"> | string | null
    postalCipher?: StringNullableFilter<"PersonAddress"> | string | null
    createdAt?: DateTimeFilter<"PersonAddress"> | Date | string
    updatedAt?: DateTimeFilter<"PersonAddress"> | Date | string
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }

  export type PersonAddressOrderByWithRelationInput = {
    id?: SortOrder
    personId?: SortOrder
    kind?: SortOrder
    lineCipher?: SortOrder
    cityCipher?: SortOrderInput | SortOrder
    regionCipher?: SortOrderInput | SortOrder
    postalCipher?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    person?: GlobalNaturalPersonOrderByWithRelationInput
  }

  export type PersonAddressWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    personId_kind?: PersonAddressPersonIdKindCompoundUniqueInput
    AND?: PersonAddressWhereInput | PersonAddressWhereInput[]
    OR?: PersonAddressWhereInput[]
    NOT?: PersonAddressWhereInput | PersonAddressWhereInput[]
    personId?: UuidFilter<"PersonAddress"> | string
    kind?: EnumPersonAddressKindFilter<"PersonAddress"> | $Enums.PersonAddressKind
    lineCipher?: StringFilter<"PersonAddress"> | string
    cityCipher?: StringNullableFilter<"PersonAddress"> | string | null
    regionCipher?: StringNullableFilter<"PersonAddress"> | string | null
    postalCipher?: StringNullableFilter<"PersonAddress"> | string | null
    createdAt?: DateTimeFilter<"PersonAddress"> | Date | string
    updatedAt?: DateTimeFilter<"PersonAddress"> | Date | string
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }, "id" | "personId_kind">

  export type PersonAddressOrderByWithAggregationInput = {
    id?: SortOrder
    personId?: SortOrder
    kind?: SortOrder
    lineCipher?: SortOrder
    cityCipher?: SortOrderInput | SortOrder
    regionCipher?: SortOrderInput | SortOrder
    postalCipher?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PersonAddressCountOrderByAggregateInput
    _max?: PersonAddressMaxOrderByAggregateInput
    _min?: PersonAddressMinOrderByAggregateInput
  }

  export type PersonAddressScalarWhereWithAggregatesInput = {
    AND?: PersonAddressScalarWhereWithAggregatesInput | PersonAddressScalarWhereWithAggregatesInput[]
    OR?: PersonAddressScalarWhereWithAggregatesInput[]
    NOT?: PersonAddressScalarWhereWithAggregatesInput | PersonAddressScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"PersonAddress"> | string
    personId?: UuidWithAggregatesFilter<"PersonAddress"> | string
    kind?: EnumPersonAddressKindWithAggregatesFilter<"PersonAddress"> | $Enums.PersonAddressKind
    lineCipher?: StringWithAggregatesFilter<"PersonAddress"> | string
    cityCipher?: StringNullableWithAggregatesFilter<"PersonAddress"> | string | null
    regionCipher?: StringNullableWithAggregatesFilter<"PersonAddress"> | string | null
    postalCipher?: StringNullableWithAggregatesFilter<"PersonAddress"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PersonAddress"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PersonAddress"> | Date | string
  }

  export type PersonIdentifierWhereInput = {
    AND?: PersonIdentifierWhereInput | PersonIdentifierWhereInput[]
    OR?: PersonIdentifierWhereInput[]
    NOT?: PersonIdentifierWhereInput | PersonIdentifierWhereInput[]
    id?: UuidFilter<"PersonIdentifier"> | string
    personId?: UuidFilter<"PersonIdentifier"> | string
    type?: EnumPersonIdentifierTypeFilter<"PersonIdentifier"> | $Enums.PersonIdentifierType
    issuingCountry?: StringFilter<"PersonIdentifier"> | string
    valueCipher?: StringFilter<"PersonIdentifier"> | string
    blindIndex?: StringFilter<"PersonIdentifier"> | string
    trust?: EnumIdentifierTrustFilter<"PersonIdentifier"> | $Enums.IdentifierTrust
    isPrimary?: BoolFilter<"PersonIdentifier"> | boolean
    createdAt?: DateTimeFilter<"PersonIdentifier"> | Date | string
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }

  export type PersonIdentifierOrderByWithRelationInput = {
    id?: SortOrder
    personId?: SortOrder
    type?: SortOrder
    issuingCountry?: SortOrder
    valueCipher?: SortOrder
    blindIndex?: SortOrder
    trust?: SortOrder
    isPrimary?: SortOrder
    createdAt?: SortOrder
    person?: GlobalNaturalPersonOrderByWithRelationInput
  }

  export type PersonIdentifierWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    type_issuingCountry_blindIndex?: PersonIdentifierTypeIssuingCountryBlindIndexCompoundUniqueInput
    AND?: PersonIdentifierWhereInput | PersonIdentifierWhereInput[]
    OR?: PersonIdentifierWhereInput[]
    NOT?: PersonIdentifierWhereInput | PersonIdentifierWhereInput[]
    personId?: UuidFilter<"PersonIdentifier"> | string
    type?: EnumPersonIdentifierTypeFilter<"PersonIdentifier"> | $Enums.PersonIdentifierType
    issuingCountry?: StringFilter<"PersonIdentifier"> | string
    valueCipher?: StringFilter<"PersonIdentifier"> | string
    blindIndex?: StringFilter<"PersonIdentifier"> | string
    trust?: EnumIdentifierTrustFilter<"PersonIdentifier"> | $Enums.IdentifierTrust
    isPrimary?: BoolFilter<"PersonIdentifier"> | boolean
    createdAt?: DateTimeFilter<"PersonIdentifier"> | Date | string
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }, "id" | "type_issuingCountry_blindIndex">

  export type PersonIdentifierOrderByWithAggregationInput = {
    id?: SortOrder
    personId?: SortOrder
    type?: SortOrder
    issuingCountry?: SortOrder
    valueCipher?: SortOrder
    blindIndex?: SortOrder
    trust?: SortOrder
    isPrimary?: SortOrder
    createdAt?: SortOrder
    _count?: PersonIdentifierCountOrderByAggregateInput
    _max?: PersonIdentifierMaxOrderByAggregateInput
    _min?: PersonIdentifierMinOrderByAggregateInput
  }

  export type PersonIdentifierScalarWhereWithAggregatesInput = {
    AND?: PersonIdentifierScalarWhereWithAggregatesInput | PersonIdentifierScalarWhereWithAggregatesInput[]
    OR?: PersonIdentifierScalarWhereWithAggregatesInput[]
    NOT?: PersonIdentifierScalarWhereWithAggregatesInput | PersonIdentifierScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"PersonIdentifier"> | string
    personId?: UuidWithAggregatesFilter<"PersonIdentifier"> | string
    type?: EnumPersonIdentifierTypeWithAggregatesFilter<"PersonIdentifier"> | $Enums.PersonIdentifierType
    issuingCountry?: StringWithAggregatesFilter<"PersonIdentifier"> | string
    valueCipher?: StringWithAggregatesFilter<"PersonIdentifier"> | string
    blindIndex?: StringWithAggregatesFilter<"PersonIdentifier"> | string
    trust?: EnumIdentifierTrustWithAggregatesFilter<"PersonIdentifier"> | $Enums.IdentifierTrust
    isPrimary?: BoolWithAggregatesFilter<"PersonIdentifier"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"PersonIdentifier"> | Date | string
  }

  export type GlobalLegalEntityWhereInput = {
    AND?: GlobalLegalEntityWhereInput | GlobalLegalEntityWhereInput[]
    OR?: GlobalLegalEntityWhereInput[]
    NOT?: GlobalLegalEntityWhereInput | GlobalLegalEntityWhereInput[]
    id?: UuidFilter<"GlobalLegalEntity"> | string
    taxIdBlindIndex?: StringFilter<"GlobalLegalEntity"> | string
    taxIdCipher?: StringFilter<"GlobalLegalEntity"> | string
    nameCipher?: StringFilter<"GlobalLegalEntity"> | string
    organizationId?: UuidNullableFilter<"GlobalLegalEntity"> | string | null
    createdAt?: DateTimeFilter<"GlobalLegalEntity"> | Date | string
    updatedAt?: DateTimeFilter<"GlobalLegalEntity"> | Date | string
  }

  export type GlobalLegalEntityOrderByWithRelationInput = {
    id?: SortOrder
    taxIdBlindIndex?: SortOrder
    taxIdCipher?: SortOrder
    nameCipher?: SortOrder
    organizationId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GlobalLegalEntityWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    taxIdBlindIndex?: string
    organizationId?: string
    AND?: GlobalLegalEntityWhereInput | GlobalLegalEntityWhereInput[]
    OR?: GlobalLegalEntityWhereInput[]
    NOT?: GlobalLegalEntityWhereInput | GlobalLegalEntityWhereInput[]
    taxIdCipher?: StringFilter<"GlobalLegalEntity"> | string
    nameCipher?: StringFilter<"GlobalLegalEntity"> | string
    createdAt?: DateTimeFilter<"GlobalLegalEntity"> | Date | string
    updatedAt?: DateTimeFilter<"GlobalLegalEntity"> | Date | string
  }, "id" | "taxIdBlindIndex" | "organizationId">

  export type GlobalLegalEntityOrderByWithAggregationInput = {
    id?: SortOrder
    taxIdBlindIndex?: SortOrder
    taxIdCipher?: SortOrder
    nameCipher?: SortOrder
    organizationId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: GlobalLegalEntityCountOrderByAggregateInput
    _max?: GlobalLegalEntityMaxOrderByAggregateInput
    _min?: GlobalLegalEntityMinOrderByAggregateInput
  }

  export type GlobalLegalEntityScalarWhereWithAggregatesInput = {
    AND?: GlobalLegalEntityScalarWhereWithAggregatesInput | GlobalLegalEntityScalarWhereWithAggregatesInput[]
    OR?: GlobalLegalEntityScalarWhereWithAggregatesInput[]
    NOT?: GlobalLegalEntityScalarWhereWithAggregatesInput | GlobalLegalEntityScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"GlobalLegalEntity"> | string
    taxIdBlindIndex?: StringWithAggregatesFilter<"GlobalLegalEntity"> | string
    taxIdCipher?: StringWithAggregatesFilter<"GlobalLegalEntity"> | string
    nameCipher?: StringWithAggregatesFilter<"GlobalLegalEntity"> | string
    organizationId?: UuidNullableWithAggregatesFilter<"GlobalLegalEntity"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"GlobalLegalEntity"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"GlobalLegalEntity"> | Date | string
  }

  export type PersonAccessRequestWhereInput = {
    AND?: PersonAccessRequestWhereInput | PersonAccessRequestWhereInput[]
    OR?: PersonAccessRequestWhereInput[]
    NOT?: PersonAccessRequestWhereInput | PersonAccessRequestWhereInput[]
    id?: UuidFilter<"PersonAccessRequest"> | string
    personId?: UuidFilter<"PersonAccessRequest"> | string
    requesterOrgId?: UuidFilter<"PersonAccessRequest"> | string
    purpose?: StringFilter<"PersonAccessRequest"> | string
    status?: EnumPersonAccessRequestStatusFilter<"PersonAccessRequest"> | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFilter<"PersonAccessRequest"> | Date | string
    decidedAt?: DateTimeNullableFilter<"PersonAccessRequest"> | Date | string | null
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }

  export type PersonAccessRequestOrderByWithRelationInput = {
    id?: SortOrder
    personId?: SortOrder
    requesterOrgId?: SortOrder
    purpose?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    decidedAt?: SortOrderInput | SortOrder
    person?: GlobalNaturalPersonOrderByWithRelationInput
  }

  export type PersonAccessRequestWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PersonAccessRequestWhereInput | PersonAccessRequestWhereInput[]
    OR?: PersonAccessRequestWhereInput[]
    NOT?: PersonAccessRequestWhereInput | PersonAccessRequestWhereInput[]
    personId?: UuidFilter<"PersonAccessRequest"> | string
    requesterOrgId?: UuidFilter<"PersonAccessRequest"> | string
    purpose?: StringFilter<"PersonAccessRequest"> | string
    status?: EnumPersonAccessRequestStatusFilter<"PersonAccessRequest"> | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFilter<"PersonAccessRequest"> | Date | string
    decidedAt?: DateTimeNullableFilter<"PersonAccessRequest"> | Date | string | null
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }, "id">

  export type PersonAccessRequestOrderByWithAggregationInput = {
    id?: SortOrder
    personId?: SortOrder
    requesterOrgId?: SortOrder
    purpose?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    decidedAt?: SortOrderInput | SortOrder
    _count?: PersonAccessRequestCountOrderByAggregateInput
    _max?: PersonAccessRequestMaxOrderByAggregateInput
    _min?: PersonAccessRequestMinOrderByAggregateInput
  }

  export type PersonAccessRequestScalarWhereWithAggregatesInput = {
    AND?: PersonAccessRequestScalarWhereWithAggregatesInput | PersonAccessRequestScalarWhereWithAggregatesInput[]
    OR?: PersonAccessRequestScalarWhereWithAggregatesInput[]
    NOT?: PersonAccessRequestScalarWhereWithAggregatesInput | PersonAccessRequestScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"PersonAccessRequest"> | string
    personId?: UuidWithAggregatesFilter<"PersonAccessRequest"> | string
    requesterOrgId?: UuidWithAggregatesFilter<"PersonAccessRequest"> | string
    purpose?: StringWithAggregatesFilter<"PersonAccessRequest"> | string
    status?: EnumPersonAccessRequestStatusWithAggregatesFilter<"PersonAccessRequest"> | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeWithAggregatesFilter<"PersonAccessRequest"> | Date | string
    decidedAt?: DateTimeNullableWithAggregatesFilter<"PersonAccessRequest"> | Date | string | null
  }

  export type PersonAccessGrantWhereInput = {
    AND?: PersonAccessGrantWhereInput | PersonAccessGrantWhereInput[]
    OR?: PersonAccessGrantWhereInput[]
    NOT?: PersonAccessGrantWhereInput | PersonAccessGrantWhereInput[]
    id?: UuidFilter<"PersonAccessGrant"> | string
    personId?: UuidFilter<"PersonAccessGrant"> | string
    granteeOrgId?: UuidFilter<"PersonAccessGrant"> | string
    grantedAt?: DateTimeFilter<"PersonAccessGrant"> | Date | string
    expiresAt?: DateTimeNullableFilter<"PersonAccessGrant"> | Date | string | null
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }

  export type PersonAccessGrantOrderByWithRelationInput = {
    id?: SortOrder
    personId?: SortOrder
    granteeOrgId?: SortOrder
    grantedAt?: SortOrder
    expiresAt?: SortOrderInput | SortOrder
    person?: GlobalNaturalPersonOrderByWithRelationInput
  }

  export type PersonAccessGrantWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    personId_granteeOrgId?: PersonAccessGrantPersonIdGranteeOrgIdCompoundUniqueInput
    AND?: PersonAccessGrantWhereInput | PersonAccessGrantWhereInput[]
    OR?: PersonAccessGrantWhereInput[]
    NOT?: PersonAccessGrantWhereInput | PersonAccessGrantWhereInput[]
    personId?: UuidFilter<"PersonAccessGrant"> | string
    granteeOrgId?: UuidFilter<"PersonAccessGrant"> | string
    grantedAt?: DateTimeFilter<"PersonAccessGrant"> | Date | string
    expiresAt?: DateTimeNullableFilter<"PersonAccessGrant"> | Date | string | null
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }, "id" | "personId_granteeOrgId">

  export type PersonAccessGrantOrderByWithAggregationInput = {
    id?: SortOrder
    personId?: SortOrder
    granteeOrgId?: SortOrder
    grantedAt?: SortOrder
    expiresAt?: SortOrderInput | SortOrder
    _count?: PersonAccessGrantCountOrderByAggregateInput
    _max?: PersonAccessGrantMaxOrderByAggregateInput
    _min?: PersonAccessGrantMinOrderByAggregateInput
  }

  export type PersonAccessGrantScalarWhereWithAggregatesInput = {
    AND?: PersonAccessGrantScalarWhereWithAggregatesInput | PersonAccessGrantScalarWhereWithAggregatesInput[]
    OR?: PersonAccessGrantScalarWhereWithAggregatesInput[]
    NOT?: PersonAccessGrantScalarWhereWithAggregatesInput | PersonAccessGrantScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"PersonAccessGrant"> | string
    personId?: UuidWithAggregatesFilter<"PersonAccessGrant"> | string
    granteeOrgId?: UuidWithAggregatesFilter<"PersonAccessGrant"> | string
    grantedAt?: DateTimeWithAggregatesFilter<"PersonAccessGrant"> | Date | string
    expiresAt?: DateTimeNullableWithAggregatesFilter<"PersonAccessGrant"> | Date | string | null
  }

  export type PersonAccessLogWhereInput = {
    AND?: PersonAccessLogWhereInput | PersonAccessLogWhereInput[]
    OR?: PersonAccessLogWhereInput[]
    NOT?: PersonAccessLogWhereInput | PersonAccessLogWhereInput[]
    id?: UuidFilter<"PersonAccessLog"> | string
    personId?: UuidFilter<"PersonAccessLog"> | string
    actorOrgId?: UuidFilter<"PersonAccessLog"> | string
    action?: StringFilter<"PersonAccessLog"> | string
    metaJson?: StringNullableFilter<"PersonAccessLog"> | string | null
    createdAt?: DateTimeFilter<"PersonAccessLog"> | Date | string
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }

  export type PersonAccessLogOrderByWithRelationInput = {
    id?: SortOrder
    personId?: SortOrder
    actorOrgId?: SortOrder
    action?: SortOrder
    metaJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    person?: GlobalNaturalPersonOrderByWithRelationInput
  }

  export type PersonAccessLogWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PersonAccessLogWhereInput | PersonAccessLogWhereInput[]
    OR?: PersonAccessLogWhereInput[]
    NOT?: PersonAccessLogWhereInput | PersonAccessLogWhereInput[]
    personId?: UuidFilter<"PersonAccessLog"> | string
    actorOrgId?: UuidFilter<"PersonAccessLog"> | string
    action?: StringFilter<"PersonAccessLog"> | string
    metaJson?: StringNullableFilter<"PersonAccessLog"> | string | null
    createdAt?: DateTimeFilter<"PersonAccessLog"> | Date | string
    person?: XOR<GlobalNaturalPersonScalarRelationFilter, GlobalNaturalPersonWhereInput>
  }, "id">

  export type PersonAccessLogOrderByWithAggregationInput = {
    id?: SortOrder
    personId?: SortOrder
    actorOrgId?: SortOrder
    action?: SortOrder
    metaJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: PersonAccessLogCountOrderByAggregateInput
    _max?: PersonAccessLogMaxOrderByAggregateInput
    _min?: PersonAccessLogMinOrderByAggregateInput
  }

  export type PersonAccessLogScalarWhereWithAggregatesInput = {
    AND?: PersonAccessLogScalarWhereWithAggregatesInput | PersonAccessLogScalarWhereWithAggregatesInput[]
    OR?: PersonAccessLogScalarWhereWithAggregatesInput[]
    NOT?: PersonAccessLogScalarWhereWithAggregatesInput | PersonAccessLogScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"PersonAccessLog"> | string
    personId?: UuidWithAggregatesFilter<"PersonAccessLog"> | string
    actorOrgId?: UuidWithAggregatesFilter<"PersonAccessLog"> | string
    action?: StringWithAggregatesFilter<"PersonAccessLog"> | string
    metaJson?: StringNullableWithAggregatesFilter<"PersonAccessLog"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PersonAccessLog"> | Date | string
  }

  export type GlobalNaturalPersonCreateInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressCreateNestedManyWithoutPersonInput
    mergedInto?: GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput
    mergedFrom?: GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUncheckedCreateInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressUncheckedCreateNestedManyWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUpdateManyWithoutPersonNestedInput
    mergedInto?: GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput
    mergedFrom?: GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUncheckedUpdateManyWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonCreateManyInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GlobalNaturalPersonUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalNaturalPersonUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonHrProfileCreateInput = {
    id?: string
    bloodGroup?: $Enums.BloodGroup
    maritalStatus?: $Enums.MaritalStatus | null
    educationCipher?: string | null
    specialtyCipher?: string | null
    statisticalCategories?: PersonHrProfileCreatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    person: GlobalNaturalPersonCreateNestedOneWithoutHrProfileInput
  }

  export type PersonHrProfileUncheckedCreateInput = {
    id?: string
    personId: string
    bloodGroup?: $Enums.BloodGroup
    maritalStatus?: $Enums.MaritalStatus | null
    educationCipher?: string | null
    specialtyCipher?: string | null
    statisticalCategories?: PersonHrProfileCreatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonHrProfileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bloodGroup?: EnumBloodGroupFieldUpdateOperationsInput | $Enums.BloodGroup
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationCipher?: NullableStringFieldUpdateOperationsInput | string | null
    specialtyCipher?: NullableStringFieldUpdateOperationsInput | string | null
    statisticalCategories?: PersonHrProfileUpdatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    person?: GlobalNaturalPersonUpdateOneRequiredWithoutHrProfileNestedInput
  }

  export type PersonHrProfileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    bloodGroup?: EnumBloodGroupFieldUpdateOperationsInput | $Enums.BloodGroup
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationCipher?: NullableStringFieldUpdateOperationsInput | string | null
    specialtyCipher?: NullableStringFieldUpdateOperationsInput | string | null
    statisticalCategories?: PersonHrProfileUpdatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonHrProfileCreateManyInput = {
    id?: string
    personId: string
    bloodGroup?: $Enums.BloodGroup
    maritalStatus?: $Enums.MaritalStatus | null
    educationCipher?: string | null
    specialtyCipher?: string | null
    statisticalCategories?: PersonHrProfileCreatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonHrProfileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    bloodGroup?: EnumBloodGroupFieldUpdateOperationsInput | $Enums.BloodGroup
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationCipher?: NullableStringFieldUpdateOperationsInput | string | null
    specialtyCipher?: NullableStringFieldUpdateOperationsInput | string | null
    statisticalCategories?: PersonHrProfileUpdatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonHrProfileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    bloodGroup?: EnumBloodGroupFieldUpdateOperationsInput | $Enums.BloodGroup
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationCipher?: NullableStringFieldUpdateOperationsInput | string | null
    specialtyCipher?: NullableStringFieldUpdateOperationsInput | string | null
    statisticalCategories?: PersonHrProfileUpdatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAddressCreateInput = {
    id?: string
    kind: $Enums.PersonAddressKind
    lineCipher: string
    cityCipher?: string | null
    regionCipher?: string | null
    postalCipher?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    person: GlobalNaturalPersonCreateNestedOneWithoutAddressesInput
  }

  export type PersonAddressUncheckedCreateInput = {
    id?: string
    personId: string
    kind: $Enums.PersonAddressKind
    lineCipher: string
    cityCipher?: string | null
    regionCipher?: string | null
    postalCipher?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonAddressUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    kind?: EnumPersonAddressKindFieldUpdateOperationsInput | $Enums.PersonAddressKind
    lineCipher?: StringFieldUpdateOperationsInput | string
    cityCipher?: NullableStringFieldUpdateOperationsInput | string | null
    regionCipher?: NullableStringFieldUpdateOperationsInput | string | null
    postalCipher?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    person?: GlobalNaturalPersonUpdateOneRequiredWithoutAddressesNestedInput
  }

  export type PersonAddressUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    kind?: EnumPersonAddressKindFieldUpdateOperationsInput | $Enums.PersonAddressKind
    lineCipher?: StringFieldUpdateOperationsInput | string
    cityCipher?: NullableStringFieldUpdateOperationsInput | string | null
    regionCipher?: NullableStringFieldUpdateOperationsInput | string | null
    postalCipher?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAddressCreateManyInput = {
    id?: string
    personId: string
    kind: $Enums.PersonAddressKind
    lineCipher: string
    cityCipher?: string | null
    regionCipher?: string | null
    postalCipher?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonAddressUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    kind?: EnumPersonAddressKindFieldUpdateOperationsInput | $Enums.PersonAddressKind
    lineCipher?: StringFieldUpdateOperationsInput | string
    cityCipher?: NullableStringFieldUpdateOperationsInput | string | null
    regionCipher?: NullableStringFieldUpdateOperationsInput | string | null
    postalCipher?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAddressUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    kind?: EnumPersonAddressKindFieldUpdateOperationsInput | $Enums.PersonAddressKind
    lineCipher?: StringFieldUpdateOperationsInput | string
    cityCipher?: NullableStringFieldUpdateOperationsInput | string | null
    regionCipher?: NullableStringFieldUpdateOperationsInput | string | null
    postalCipher?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonIdentifierCreateInput = {
    id?: string
    type: $Enums.PersonIdentifierType
    issuingCountry?: string
    valueCipher: string
    blindIndex: string
    trust?: $Enums.IdentifierTrust
    isPrimary?: boolean
    createdAt?: Date | string
    person: GlobalNaturalPersonCreateNestedOneWithoutIdentifiersInput
  }

  export type PersonIdentifierUncheckedCreateInput = {
    id?: string
    personId: string
    type: $Enums.PersonIdentifierType
    issuingCountry?: string
    valueCipher: string
    blindIndex: string
    trust?: $Enums.IdentifierTrust
    isPrimary?: boolean
    createdAt?: Date | string
  }

  export type PersonIdentifierUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumPersonIdentifierTypeFieldUpdateOperationsInput | $Enums.PersonIdentifierType
    issuingCountry?: StringFieldUpdateOperationsInput | string
    valueCipher?: StringFieldUpdateOperationsInput | string
    blindIndex?: StringFieldUpdateOperationsInput | string
    trust?: EnumIdentifierTrustFieldUpdateOperationsInput | $Enums.IdentifierTrust
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    person?: GlobalNaturalPersonUpdateOneRequiredWithoutIdentifiersNestedInput
  }

  export type PersonIdentifierUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    type?: EnumPersonIdentifierTypeFieldUpdateOperationsInput | $Enums.PersonIdentifierType
    issuingCountry?: StringFieldUpdateOperationsInput | string
    valueCipher?: StringFieldUpdateOperationsInput | string
    blindIndex?: StringFieldUpdateOperationsInput | string
    trust?: EnumIdentifierTrustFieldUpdateOperationsInput | $Enums.IdentifierTrust
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonIdentifierCreateManyInput = {
    id?: string
    personId: string
    type: $Enums.PersonIdentifierType
    issuingCountry?: string
    valueCipher: string
    blindIndex: string
    trust?: $Enums.IdentifierTrust
    isPrimary?: boolean
    createdAt?: Date | string
  }

  export type PersonIdentifierUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumPersonIdentifierTypeFieldUpdateOperationsInput | $Enums.PersonIdentifierType
    issuingCountry?: StringFieldUpdateOperationsInput | string
    valueCipher?: StringFieldUpdateOperationsInput | string
    blindIndex?: StringFieldUpdateOperationsInput | string
    trust?: EnumIdentifierTrustFieldUpdateOperationsInput | $Enums.IdentifierTrust
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonIdentifierUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    type?: EnumPersonIdentifierTypeFieldUpdateOperationsInput | $Enums.PersonIdentifierType
    issuingCountry?: StringFieldUpdateOperationsInput | string
    valueCipher?: StringFieldUpdateOperationsInput | string
    blindIndex?: StringFieldUpdateOperationsInput | string
    trust?: EnumIdentifierTrustFieldUpdateOperationsInput | $Enums.IdentifierTrust
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalLegalEntityCreateInput = {
    id?: string
    taxIdBlindIndex: string
    taxIdCipher: string
    nameCipher: string
    organizationId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GlobalLegalEntityUncheckedCreateInput = {
    id?: string
    taxIdBlindIndex: string
    taxIdCipher: string
    nameCipher: string
    organizationId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GlobalLegalEntityUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    taxIdBlindIndex?: StringFieldUpdateOperationsInput | string
    taxIdCipher?: StringFieldUpdateOperationsInput | string
    nameCipher?: StringFieldUpdateOperationsInput | string
    organizationId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalLegalEntityUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    taxIdBlindIndex?: StringFieldUpdateOperationsInput | string
    taxIdCipher?: StringFieldUpdateOperationsInput | string
    nameCipher?: StringFieldUpdateOperationsInput | string
    organizationId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalLegalEntityCreateManyInput = {
    id?: string
    taxIdBlindIndex: string
    taxIdCipher: string
    nameCipher: string
    organizationId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GlobalLegalEntityUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    taxIdBlindIndex?: StringFieldUpdateOperationsInput | string
    taxIdCipher?: StringFieldUpdateOperationsInput | string
    nameCipher?: StringFieldUpdateOperationsInput | string
    organizationId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalLegalEntityUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    taxIdBlindIndex?: StringFieldUpdateOperationsInput | string
    taxIdCipher?: StringFieldUpdateOperationsInput | string
    nameCipher?: StringFieldUpdateOperationsInput | string
    organizationId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAccessRequestCreateInput = {
    id?: string
    requesterOrgId: string
    purpose: string
    status?: $Enums.PersonAccessRequestStatus
    createdAt?: Date | string
    decidedAt?: Date | string | null
    person: GlobalNaturalPersonCreateNestedOneWithoutAccessRequestsInput
  }

  export type PersonAccessRequestUncheckedCreateInput = {
    id?: string
    personId: string
    requesterOrgId: string
    purpose: string
    status?: $Enums.PersonAccessRequestStatus
    createdAt?: Date | string
    decidedAt?: Date | string | null
  }

  export type PersonAccessRequestUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    requesterOrgId?: StringFieldUpdateOperationsInput | string
    purpose?: StringFieldUpdateOperationsInput | string
    status?: EnumPersonAccessRequestStatusFieldUpdateOperationsInput | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    decidedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    person?: GlobalNaturalPersonUpdateOneRequiredWithoutAccessRequestsNestedInput
  }

  export type PersonAccessRequestUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    requesterOrgId?: StringFieldUpdateOperationsInput | string
    purpose?: StringFieldUpdateOperationsInput | string
    status?: EnumPersonAccessRequestStatusFieldUpdateOperationsInput | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    decidedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessRequestCreateManyInput = {
    id?: string
    personId: string
    requesterOrgId: string
    purpose: string
    status?: $Enums.PersonAccessRequestStatus
    createdAt?: Date | string
    decidedAt?: Date | string | null
  }

  export type PersonAccessRequestUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    requesterOrgId?: StringFieldUpdateOperationsInput | string
    purpose?: StringFieldUpdateOperationsInput | string
    status?: EnumPersonAccessRequestStatusFieldUpdateOperationsInput | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    decidedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessRequestUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    requesterOrgId?: StringFieldUpdateOperationsInput | string
    purpose?: StringFieldUpdateOperationsInput | string
    status?: EnumPersonAccessRequestStatusFieldUpdateOperationsInput | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    decidedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessGrantCreateInput = {
    id?: string
    granteeOrgId: string
    grantedAt?: Date | string
    expiresAt?: Date | string | null
    person: GlobalNaturalPersonCreateNestedOneWithoutAccessGrantsInput
  }

  export type PersonAccessGrantUncheckedCreateInput = {
    id?: string
    personId: string
    granteeOrgId: string
    grantedAt?: Date | string
    expiresAt?: Date | string | null
  }

  export type PersonAccessGrantUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    granteeOrgId?: StringFieldUpdateOperationsInput | string
    grantedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    person?: GlobalNaturalPersonUpdateOneRequiredWithoutAccessGrantsNestedInput
  }

  export type PersonAccessGrantUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    granteeOrgId?: StringFieldUpdateOperationsInput | string
    grantedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessGrantCreateManyInput = {
    id?: string
    personId: string
    granteeOrgId: string
    grantedAt?: Date | string
    expiresAt?: Date | string | null
  }

  export type PersonAccessGrantUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    granteeOrgId?: StringFieldUpdateOperationsInput | string
    grantedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessGrantUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    granteeOrgId?: StringFieldUpdateOperationsInput | string
    grantedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessLogCreateInput = {
    id?: string
    actorOrgId: string
    action: string
    metaJson?: string | null
    createdAt?: Date | string
    person: GlobalNaturalPersonCreateNestedOneWithoutAccessLogsInput
  }

  export type PersonAccessLogUncheckedCreateInput = {
    id?: string
    personId: string
    actorOrgId: string
    action: string
    metaJson?: string | null
    createdAt?: Date | string
  }

  export type PersonAccessLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorOrgId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    metaJson?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    person?: GlobalNaturalPersonUpdateOneRequiredWithoutAccessLogsNestedInput
  }

  export type PersonAccessLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    actorOrgId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    metaJson?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAccessLogCreateManyInput = {
    id?: string
    personId: string
    actorOrgId: string
    action: string
    metaJson?: string | null
    createdAt?: Date | string
  }

  export type PersonAccessLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorOrgId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    metaJson?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAccessLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    personId?: StringFieldUpdateOperationsInput | string
    actorOrgId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    metaJson?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
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

  export type EnumPersonSexFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonSex | EnumPersonSexFieldRefInput<$PrismaModel>
    in?: $Enums.PersonSex[] | ListEnumPersonSexFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonSex[] | ListEnumPersonSexFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonSexFilter<$PrismaModel> | $Enums.PersonSex
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

  export type EnumPersonSegmentFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonSegment | EnumPersonSegmentFieldRefInput<$PrismaModel>
    in?: $Enums.PersonSegment[] | ListEnumPersonSegmentFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonSegment[] | ListEnumPersonSegmentFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonSegmentFilter<$PrismaModel> | $Enums.PersonSegment
  }

  export type UuidNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidNullableFilter<$PrismaModel> | string | null
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

  export type PersonIdentifierListRelationFilter = {
    every?: PersonIdentifierWhereInput
    some?: PersonIdentifierWhereInput
    none?: PersonIdentifierWhereInput
  }

  export type PersonAccessRequestListRelationFilter = {
    every?: PersonAccessRequestWhereInput
    some?: PersonAccessRequestWhereInput
    none?: PersonAccessRequestWhereInput
  }

  export type PersonAccessGrantListRelationFilter = {
    every?: PersonAccessGrantWhereInput
    some?: PersonAccessGrantWhereInput
    none?: PersonAccessGrantWhereInput
  }

  export type PersonAccessLogListRelationFilter = {
    every?: PersonAccessLogWhereInput
    some?: PersonAccessLogWhereInput
    none?: PersonAccessLogWhereInput
  }

  export type PersonHrProfileNullableScalarRelationFilter = {
    is?: PersonHrProfileWhereInput | null
    isNot?: PersonHrProfileWhereInput | null
  }

  export type PersonAddressListRelationFilter = {
    every?: PersonAddressWhereInput
    some?: PersonAddressWhereInput
    none?: PersonAddressWhereInput
  }

  export type GlobalNaturalPersonNullableScalarRelationFilter = {
    is?: GlobalNaturalPersonWhereInput | null
    isNot?: GlobalNaturalPersonWhereInput | null
  }

  export type GlobalNaturalPersonListRelationFilter = {
    every?: GlobalNaturalPersonWhereInput
    some?: GlobalNaturalPersonWhereInput
    none?: GlobalNaturalPersonWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type PersonIdentifierOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PersonAccessRequestOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PersonAccessGrantOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PersonAccessLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PersonAddressOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type GlobalNaturalPersonOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type GlobalNaturalPersonCountOrderByAggregateInput = {
    id?: SortOrder
    finBlindIndex?: SortOrder
    finCipher?: SortOrder
    firstNameCipher?: SortOrder
    middleNameCipher?: SortOrder
    lastNameCipher?: SortOrder
    fullNameCipher?: SortOrder
    phoneCipher?: SortOrder
    nationality?: SortOrder
    sex?: SortOrder
    birthDate?: SortOrder
    personSegment?: SortOrder
    mergedIntoPersonId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GlobalNaturalPersonMaxOrderByAggregateInput = {
    id?: SortOrder
    finBlindIndex?: SortOrder
    finCipher?: SortOrder
    firstNameCipher?: SortOrder
    middleNameCipher?: SortOrder
    lastNameCipher?: SortOrder
    fullNameCipher?: SortOrder
    phoneCipher?: SortOrder
    nationality?: SortOrder
    sex?: SortOrder
    birthDate?: SortOrder
    personSegment?: SortOrder
    mergedIntoPersonId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GlobalNaturalPersonMinOrderByAggregateInput = {
    id?: SortOrder
    finBlindIndex?: SortOrder
    finCipher?: SortOrder
    firstNameCipher?: SortOrder
    middleNameCipher?: SortOrder
    lastNameCipher?: SortOrder
    fullNameCipher?: SortOrder
    phoneCipher?: SortOrder
    nationality?: SortOrder
    sex?: SortOrder
    birthDate?: SortOrder
    personSegment?: SortOrder
    mergedIntoPersonId?: SortOrder
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

  export type EnumPersonSexWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonSex | EnumPersonSexFieldRefInput<$PrismaModel>
    in?: $Enums.PersonSex[] | ListEnumPersonSexFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonSex[] | ListEnumPersonSexFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonSexWithAggregatesFilter<$PrismaModel> | $Enums.PersonSex
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonSexFilter<$PrismaModel>
    _max?: NestedEnumPersonSexFilter<$PrismaModel>
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

  export type EnumPersonSegmentWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonSegment | EnumPersonSegmentFieldRefInput<$PrismaModel>
    in?: $Enums.PersonSegment[] | ListEnumPersonSegmentFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonSegment[] | ListEnumPersonSegmentFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonSegmentWithAggregatesFilter<$PrismaModel> | $Enums.PersonSegment
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonSegmentFilter<$PrismaModel>
    _max?: NestedEnumPersonSegmentFilter<$PrismaModel>
  }

  export type UuidNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
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

  export type EnumBloodGroupFilter<$PrismaModel = never> = {
    equals?: $Enums.BloodGroup | EnumBloodGroupFieldRefInput<$PrismaModel>
    in?: $Enums.BloodGroup[] | ListEnumBloodGroupFieldRefInput<$PrismaModel>
    notIn?: $Enums.BloodGroup[] | ListEnumBloodGroupFieldRefInput<$PrismaModel>
    not?: NestedEnumBloodGroupFilter<$PrismaModel> | $Enums.BloodGroup
  }

  export type EnumMaritalStatusNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.MaritalStatus | EnumMaritalStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumMaritalStatusNullableFilter<$PrismaModel> | $Enums.MaritalStatus | null
  }

  export type EnumStatisticalCategoryNullableListFilter<$PrismaModel = never> = {
    equals?: $Enums.StatisticalCategory[] | ListEnumStatisticalCategoryFieldRefInput<$PrismaModel> | null
    has?: $Enums.StatisticalCategory | EnumStatisticalCategoryFieldRefInput<$PrismaModel> | null
    hasEvery?: $Enums.StatisticalCategory[] | ListEnumStatisticalCategoryFieldRefInput<$PrismaModel>
    hasSome?: $Enums.StatisticalCategory[] | ListEnumStatisticalCategoryFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type GlobalNaturalPersonScalarRelationFilter = {
    is?: GlobalNaturalPersonWhereInput
    isNot?: GlobalNaturalPersonWhereInput
  }

  export type PersonHrProfileCountOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    bloodGroup?: SortOrder
    maritalStatus?: SortOrder
    educationCipher?: SortOrder
    specialtyCipher?: SortOrder
    statisticalCategories?: SortOrder
    photoStorageKey?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PersonHrProfileMaxOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    bloodGroup?: SortOrder
    maritalStatus?: SortOrder
    educationCipher?: SortOrder
    specialtyCipher?: SortOrder
    photoStorageKey?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PersonHrProfileMinOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    bloodGroup?: SortOrder
    maritalStatus?: SortOrder
    educationCipher?: SortOrder
    specialtyCipher?: SortOrder
    photoStorageKey?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumBloodGroupWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.BloodGroup | EnumBloodGroupFieldRefInput<$PrismaModel>
    in?: $Enums.BloodGroup[] | ListEnumBloodGroupFieldRefInput<$PrismaModel>
    notIn?: $Enums.BloodGroup[] | ListEnumBloodGroupFieldRefInput<$PrismaModel>
    not?: NestedEnumBloodGroupWithAggregatesFilter<$PrismaModel> | $Enums.BloodGroup
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumBloodGroupFilter<$PrismaModel>
    _max?: NestedEnumBloodGroupFilter<$PrismaModel>
  }

  export type EnumMaritalStatusNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.MaritalStatus | EnumMaritalStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumMaritalStatusNullableWithAggregatesFilter<$PrismaModel> | $Enums.MaritalStatus | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumMaritalStatusNullableFilter<$PrismaModel>
    _max?: NestedEnumMaritalStatusNullableFilter<$PrismaModel>
  }

  export type EnumPersonAddressKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonAddressKind | EnumPersonAddressKindFieldRefInput<$PrismaModel>
    in?: $Enums.PersonAddressKind[] | ListEnumPersonAddressKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonAddressKind[] | ListEnumPersonAddressKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonAddressKindFilter<$PrismaModel> | $Enums.PersonAddressKind
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

  export type PersonAddressPersonIdKindCompoundUniqueInput = {
    personId: string
    kind: $Enums.PersonAddressKind
  }

  export type PersonAddressCountOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    kind?: SortOrder
    lineCipher?: SortOrder
    cityCipher?: SortOrder
    regionCipher?: SortOrder
    postalCipher?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PersonAddressMaxOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    kind?: SortOrder
    lineCipher?: SortOrder
    cityCipher?: SortOrder
    regionCipher?: SortOrder
    postalCipher?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PersonAddressMinOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    kind?: SortOrder
    lineCipher?: SortOrder
    cityCipher?: SortOrder
    regionCipher?: SortOrder
    postalCipher?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumPersonAddressKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonAddressKind | EnumPersonAddressKindFieldRefInput<$PrismaModel>
    in?: $Enums.PersonAddressKind[] | ListEnumPersonAddressKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonAddressKind[] | ListEnumPersonAddressKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonAddressKindWithAggregatesFilter<$PrismaModel> | $Enums.PersonAddressKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonAddressKindFilter<$PrismaModel>
    _max?: NestedEnumPersonAddressKindFilter<$PrismaModel>
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

  export type EnumPersonIdentifierTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonIdentifierType | EnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    in?: $Enums.PersonIdentifierType[] | ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonIdentifierType[] | ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonIdentifierTypeFilter<$PrismaModel> | $Enums.PersonIdentifierType
  }

  export type EnumIdentifierTrustFilter<$PrismaModel = never> = {
    equals?: $Enums.IdentifierTrust | EnumIdentifierTrustFieldRefInput<$PrismaModel>
    in?: $Enums.IdentifierTrust[] | ListEnumIdentifierTrustFieldRefInput<$PrismaModel>
    notIn?: $Enums.IdentifierTrust[] | ListEnumIdentifierTrustFieldRefInput<$PrismaModel>
    not?: NestedEnumIdentifierTrustFilter<$PrismaModel> | $Enums.IdentifierTrust
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type PersonIdentifierTypeIssuingCountryBlindIndexCompoundUniqueInput = {
    type: $Enums.PersonIdentifierType
    issuingCountry: string
    blindIndex: string
  }

  export type PersonIdentifierCountOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    type?: SortOrder
    issuingCountry?: SortOrder
    valueCipher?: SortOrder
    blindIndex?: SortOrder
    trust?: SortOrder
    isPrimary?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonIdentifierMaxOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    type?: SortOrder
    issuingCountry?: SortOrder
    valueCipher?: SortOrder
    blindIndex?: SortOrder
    trust?: SortOrder
    isPrimary?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonIdentifierMinOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    type?: SortOrder
    issuingCountry?: SortOrder
    valueCipher?: SortOrder
    blindIndex?: SortOrder
    trust?: SortOrder
    isPrimary?: SortOrder
    createdAt?: SortOrder
  }

  export type EnumPersonIdentifierTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonIdentifierType | EnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    in?: $Enums.PersonIdentifierType[] | ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonIdentifierType[] | ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonIdentifierTypeWithAggregatesFilter<$PrismaModel> | $Enums.PersonIdentifierType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonIdentifierTypeFilter<$PrismaModel>
    _max?: NestedEnumPersonIdentifierTypeFilter<$PrismaModel>
  }

  export type EnumIdentifierTrustWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.IdentifierTrust | EnumIdentifierTrustFieldRefInput<$PrismaModel>
    in?: $Enums.IdentifierTrust[] | ListEnumIdentifierTrustFieldRefInput<$PrismaModel>
    notIn?: $Enums.IdentifierTrust[] | ListEnumIdentifierTrustFieldRefInput<$PrismaModel>
    not?: NestedEnumIdentifierTrustWithAggregatesFilter<$PrismaModel> | $Enums.IdentifierTrust
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumIdentifierTrustFilter<$PrismaModel>
    _max?: NestedEnumIdentifierTrustFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type GlobalLegalEntityCountOrderByAggregateInput = {
    id?: SortOrder
    taxIdBlindIndex?: SortOrder
    taxIdCipher?: SortOrder
    nameCipher?: SortOrder
    organizationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GlobalLegalEntityMaxOrderByAggregateInput = {
    id?: SortOrder
    taxIdBlindIndex?: SortOrder
    taxIdCipher?: SortOrder
    nameCipher?: SortOrder
    organizationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GlobalLegalEntityMinOrderByAggregateInput = {
    id?: SortOrder
    taxIdBlindIndex?: SortOrder
    taxIdCipher?: SortOrder
    nameCipher?: SortOrder
    organizationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumPersonAccessRequestStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonAccessRequestStatus | EnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PersonAccessRequestStatus[] | ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonAccessRequestStatus[] | ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonAccessRequestStatusFilter<$PrismaModel> | $Enums.PersonAccessRequestStatus
  }

  export type PersonAccessRequestCountOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    requesterOrgId?: SortOrder
    purpose?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    decidedAt?: SortOrder
  }

  export type PersonAccessRequestMaxOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    requesterOrgId?: SortOrder
    purpose?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    decidedAt?: SortOrder
  }

  export type PersonAccessRequestMinOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    requesterOrgId?: SortOrder
    purpose?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    decidedAt?: SortOrder
  }

  export type EnumPersonAccessRequestStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonAccessRequestStatus | EnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PersonAccessRequestStatus[] | ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonAccessRequestStatus[] | ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonAccessRequestStatusWithAggregatesFilter<$PrismaModel> | $Enums.PersonAccessRequestStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonAccessRequestStatusFilter<$PrismaModel>
    _max?: NestedEnumPersonAccessRequestStatusFilter<$PrismaModel>
  }

  export type PersonAccessGrantPersonIdGranteeOrgIdCompoundUniqueInput = {
    personId: string
    granteeOrgId: string
  }

  export type PersonAccessGrantCountOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    granteeOrgId?: SortOrder
    grantedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type PersonAccessGrantMaxOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    granteeOrgId?: SortOrder
    grantedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type PersonAccessGrantMinOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    granteeOrgId?: SortOrder
    grantedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type PersonAccessLogCountOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    actorOrgId?: SortOrder
    action?: SortOrder
    metaJson?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonAccessLogMaxOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    actorOrgId?: SortOrder
    action?: SortOrder
    metaJson?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonAccessLogMinOrderByAggregateInput = {
    id?: SortOrder
    personId?: SortOrder
    actorOrgId?: SortOrder
    action?: SortOrder
    metaJson?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonIdentifierCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonIdentifierCreateWithoutPersonInput, PersonIdentifierUncheckedCreateWithoutPersonInput> | PersonIdentifierCreateWithoutPersonInput[] | PersonIdentifierUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonIdentifierCreateOrConnectWithoutPersonInput | PersonIdentifierCreateOrConnectWithoutPersonInput[]
    createMany?: PersonIdentifierCreateManyPersonInputEnvelope
    connect?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
  }

  export type PersonAccessRequestCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonAccessRequestCreateWithoutPersonInput, PersonAccessRequestUncheckedCreateWithoutPersonInput> | PersonAccessRequestCreateWithoutPersonInput[] | PersonAccessRequestUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessRequestCreateOrConnectWithoutPersonInput | PersonAccessRequestCreateOrConnectWithoutPersonInput[]
    createMany?: PersonAccessRequestCreateManyPersonInputEnvelope
    connect?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
  }

  export type PersonAccessGrantCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonAccessGrantCreateWithoutPersonInput, PersonAccessGrantUncheckedCreateWithoutPersonInput> | PersonAccessGrantCreateWithoutPersonInput[] | PersonAccessGrantUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessGrantCreateOrConnectWithoutPersonInput | PersonAccessGrantCreateOrConnectWithoutPersonInput[]
    createMany?: PersonAccessGrantCreateManyPersonInputEnvelope
    connect?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
  }

  export type PersonAccessLogCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonAccessLogCreateWithoutPersonInput, PersonAccessLogUncheckedCreateWithoutPersonInput> | PersonAccessLogCreateWithoutPersonInput[] | PersonAccessLogUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessLogCreateOrConnectWithoutPersonInput | PersonAccessLogCreateOrConnectWithoutPersonInput[]
    createMany?: PersonAccessLogCreateManyPersonInputEnvelope
    connect?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
  }

  export type PersonHrProfileCreateNestedOneWithoutPersonInput = {
    create?: XOR<PersonHrProfileCreateWithoutPersonInput, PersonHrProfileUncheckedCreateWithoutPersonInput>
    connectOrCreate?: PersonHrProfileCreateOrConnectWithoutPersonInput
    connect?: PersonHrProfileWhereUniqueInput
  }

  export type PersonAddressCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonAddressCreateWithoutPersonInput, PersonAddressUncheckedCreateWithoutPersonInput> | PersonAddressCreateWithoutPersonInput[] | PersonAddressUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAddressCreateOrConnectWithoutPersonInput | PersonAddressCreateOrConnectWithoutPersonInput[]
    createMany?: PersonAddressCreateManyPersonInputEnvelope
    connect?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
  }

  export type GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutMergedFromInput, GlobalNaturalPersonUncheckedCreateWithoutMergedFromInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutMergedFromInput
    connect?: GlobalNaturalPersonWhereUniqueInput
  }

  export type GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutMergedIntoInput, GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput> | GlobalNaturalPersonCreateWithoutMergedIntoInput[] | GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput[]
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput | GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput[]
    createMany?: GlobalNaturalPersonCreateManyMergedIntoInputEnvelope
    connect?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
  }

  export type PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonIdentifierCreateWithoutPersonInput, PersonIdentifierUncheckedCreateWithoutPersonInput> | PersonIdentifierCreateWithoutPersonInput[] | PersonIdentifierUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonIdentifierCreateOrConnectWithoutPersonInput | PersonIdentifierCreateOrConnectWithoutPersonInput[]
    createMany?: PersonIdentifierCreateManyPersonInputEnvelope
    connect?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
  }

  export type PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonAccessRequestCreateWithoutPersonInput, PersonAccessRequestUncheckedCreateWithoutPersonInput> | PersonAccessRequestCreateWithoutPersonInput[] | PersonAccessRequestUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessRequestCreateOrConnectWithoutPersonInput | PersonAccessRequestCreateOrConnectWithoutPersonInput[]
    createMany?: PersonAccessRequestCreateManyPersonInputEnvelope
    connect?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
  }

  export type PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonAccessGrantCreateWithoutPersonInput, PersonAccessGrantUncheckedCreateWithoutPersonInput> | PersonAccessGrantCreateWithoutPersonInput[] | PersonAccessGrantUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessGrantCreateOrConnectWithoutPersonInput | PersonAccessGrantCreateOrConnectWithoutPersonInput[]
    createMany?: PersonAccessGrantCreateManyPersonInputEnvelope
    connect?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
  }

  export type PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonAccessLogCreateWithoutPersonInput, PersonAccessLogUncheckedCreateWithoutPersonInput> | PersonAccessLogCreateWithoutPersonInput[] | PersonAccessLogUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessLogCreateOrConnectWithoutPersonInput | PersonAccessLogCreateOrConnectWithoutPersonInput[]
    createMany?: PersonAccessLogCreateManyPersonInputEnvelope
    connect?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
  }

  export type PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput = {
    create?: XOR<PersonHrProfileCreateWithoutPersonInput, PersonHrProfileUncheckedCreateWithoutPersonInput>
    connectOrCreate?: PersonHrProfileCreateOrConnectWithoutPersonInput
    connect?: PersonHrProfileWhereUniqueInput
  }

  export type PersonAddressUncheckedCreateNestedManyWithoutPersonInput = {
    create?: XOR<PersonAddressCreateWithoutPersonInput, PersonAddressUncheckedCreateWithoutPersonInput> | PersonAddressCreateWithoutPersonInput[] | PersonAddressUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAddressCreateOrConnectWithoutPersonInput | PersonAddressCreateOrConnectWithoutPersonInput[]
    createMany?: PersonAddressCreateManyPersonInputEnvelope
    connect?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
  }

  export type GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutMergedIntoInput, GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput> | GlobalNaturalPersonCreateWithoutMergedIntoInput[] | GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput[]
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput | GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput[]
    createMany?: GlobalNaturalPersonCreateManyMergedIntoInputEnvelope
    connect?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumPersonSexFieldUpdateOperationsInput = {
    set?: $Enums.PersonSex
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type EnumPersonSegmentFieldUpdateOperationsInput = {
    set?: $Enums.PersonSegment
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type PersonIdentifierUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonIdentifierCreateWithoutPersonInput, PersonIdentifierUncheckedCreateWithoutPersonInput> | PersonIdentifierCreateWithoutPersonInput[] | PersonIdentifierUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonIdentifierCreateOrConnectWithoutPersonInput | PersonIdentifierCreateOrConnectWithoutPersonInput[]
    upsert?: PersonIdentifierUpsertWithWhereUniqueWithoutPersonInput | PersonIdentifierUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonIdentifierCreateManyPersonInputEnvelope
    set?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
    disconnect?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
    delete?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
    connect?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
    update?: PersonIdentifierUpdateWithWhereUniqueWithoutPersonInput | PersonIdentifierUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonIdentifierUpdateManyWithWhereWithoutPersonInput | PersonIdentifierUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonIdentifierScalarWhereInput | PersonIdentifierScalarWhereInput[]
  }

  export type PersonAccessRequestUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonAccessRequestCreateWithoutPersonInput, PersonAccessRequestUncheckedCreateWithoutPersonInput> | PersonAccessRequestCreateWithoutPersonInput[] | PersonAccessRequestUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessRequestCreateOrConnectWithoutPersonInput | PersonAccessRequestCreateOrConnectWithoutPersonInput[]
    upsert?: PersonAccessRequestUpsertWithWhereUniqueWithoutPersonInput | PersonAccessRequestUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonAccessRequestCreateManyPersonInputEnvelope
    set?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
    disconnect?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
    delete?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
    connect?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
    update?: PersonAccessRequestUpdateWithWhereUniqueWithoutPersonInput | PersonAccessRequestUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonAccessRequestUpdateManyWithWhereWithoutPersonInput | PersonAccessRequestUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonAccessRequestScalarWhereInput | PersonAccessRequestScalarWhereInput[]
  }

  export type PersonAccessGrantUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonAccessGrantCreateWithoutPersonInput, PersonAccessGrantUncheckedCreateWithoutPersonInput> | PersonAccessGrantCreateWithoutPersonInput[] | PersonAccessGrantUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessGrantCreateOrConnectWithoutPersonInput | PersonAccessGrantCreateOrConnectWithoutPersonInput[]
    upsert?: PersonAccessGrantUpsertWithWhereUniqueWithoutPersonInput | PersonAccessGrantUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonAccessGrantCreateManyPersonInputEnvelope
    set?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
    disconnect?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
    delete?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
    connect?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
    update?: PersonAccessGrantUpdateWithWhereUniqueWithoutPersonInput | PersonAccessGrantUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonAccessGrantUpdateManyWithWhereWithoutPersonInput | PersonAccessGrantUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonAccessGrantScalarWhereInput | PersonAccessGrantScalarWhereInput[]
  }

  export type PersonAccessLogUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonAccessLogCreateWithoutPersonInput, PersonAccessLogUncheckedCreateWithoutPersonInput> | PersonAccessLogCreateWithoutPersonInput[] | PersonAccessLogUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessLogCreateOrConnectWithoutPersonInput | PersonAccessLogCreateOrConnectWithoutPersonInput[]
    upsert?: PersonAccessLogUpsertWithWhereUniqueWithoutPersonInput | PersonAccessLogUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonAccessLogCreateManyPersonInputEnvelope
    set?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
    disconnect?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
    delete?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
    connect?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
    update?: PersonAccessLogUpdateWithWhereUniqueWithoutPersonInput | PersonAccessLogUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonAccessLogUpdateManyWithWhereWithoutPersonInput | PersonAccessLogUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonAccessLogScalarWhereInput | PersonAccessLogScalarWhereInput[]
  }

  export type PersonHrProfileUpdateOneWithoutPersonNestedInput = {
    create?: XOR<PersonHrProfileCreateWithoutPersonInput, PersonHrProfileUncheckedCreateWithoutPersonInput>
    connectOrCreate?: PersonHrProfileCreateOrConnectWithoutPersonInput
    upsert?: PersonHrProfileUpsertWithoutPersonInput
    disconnect?: PersonHrProfileWhereInput | boolean
    delete?: PersonHrProfileWhereInput | boolean
    connect?: PersonHrProfileWhereUniqueInput
    update?: XOR<XOR<PersonHrProfileUpdateToOneWithWhereWithoutPersonInput, PersonHrProfileUpdateWithoutPersonInput>, PersonHrProfileUncheckedUpdateWithoutPersonInput>
  }

  export type PersonAddressUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonAddressCreateWithoutPersonInput, PersonAddressUncheckedCreateWithoutPersonInput> | PersonAddressCreateWithoutPersonInput[] | PersonAddressUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAddressCreateOrConnectWithoutPersonInput | PersonAddressCreateOrConnectWithoutPersonInput[]
    upsert?: PersonAddressUpsertWithWhereUniqueWithoutPersonInput | PersonAddressUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonAddressCreateManyPersonInputEnvelope
    set?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
    disconnect?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
    delete?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
    connect?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
    update?: PersonAddressUpdateWithWhereUniqueWithoutPersonInput | PersonAddressUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonAddressUpdateManyWithWhereWithoutPersonInput | PersonAddressUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonAddressScalarWhereInput | PersonAddressScalarWhereInput[]
  }

  export type GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutMergedFromInput, GlobalNaturalPersonUncheckedCreateWithoutMergedFromInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutMergedFromInput
    upsert?: GlobalNaturalPersonUpsertWithoutMergedFromInput
    disconnect?: GlobalNaturalPersonWhereInput | boolean
    delete?: GlobalNaturalPersonWhereInput | boolean
    connect?: GlobalNaturalPersonWhereUniqueInput
    update?: XOR<XOR<GlobalNaturalPersonUpdateToOneWithWhereWithoutMergedFromInput, GlobalNaturalPersonUpdateWithoutMergedFromInput>, GlobalNaturalPersonUncheckedUpdateWithoutMergedFromInput>
  }

  export type GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutMergedIntoInput, GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput> | GlobalNaturalPersonCreateWithoutMergedIntoInput[] | GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput[]
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput | GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput[]
    upsert?: GlobalNaturalPersonUpsertWithWhereUniqueWithoutMergedIntoInput | GlobalNaturalPersonUpsertWithWhereUniqueWithoutMergedIntoInput[]
    createMany?: GlobalNaturalPersonCreateManyMergedIntoInputEnvelope
    set?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
    disconnect?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
    delete?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
    connect?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
    update?: GlobalNaturalPersonUpdateWithWhereUniqueWithoutMergedIntoInput | GlobalNaturalPersonUpdateWithWhereUniqueWithoutMergedIntoInput[]
    updateMany?: GlobalNaturalPersonUpdateManyWithWhereWithoutMergedIntoInput | GlobalNaturalPersonUpdateManyWithWhereWithoutMergedIntoInput[]
    deleteMany?: GlobalNaturalPersonScalarWhereInput | GlobalNaturalPersonScalarWhereInput[]
  }

  export type PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonIdentifierCreateWithoutPersonInput, PersonIdentifierUncheckedCreateWithoutPersonInput> | PersonIdentifierCreateWithoutPersonInput[] | PersonIdentifierUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonIdentifierCreateOrConnectWithoutPersonInput | PersonIdentifierCreateOrConnectWithoutPersonInput[]
    upsert?: PersonIdentifierUpsertWithWhereUniqueWithoutPersonInput | PersonIdentifierUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonIdentifierCreateManyPersonInputEnvelope
    set?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
    disconnect?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
    delete?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
    connect?: PersonIdentifierWhereUniqueInput | PersonIdentifierWhereUniqueInput[]
    update?: PersonIdentifierUpdateWithWhereUniqueWithoutPersonInput | PersonIdentifierUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonIdentifierUpdateManyWithWhereWithoutPersonInput | PersonIdentifierUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonIdentifierScalarWhereInput | PersonIdentifierScalarWhereInput[]
  }

  export type PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonAccessRequestCreateWithoutPersonInput, PersonAccessRequestUncheckedCreateWithoutPersonInput> | PersonAccessRequestCreateWithoutPersonInput[] | PersonAccessRequestUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessRequestCreateOrConnectWithoutPersonInput | PersonAccessRequestCreateOrConnectWithoutPersonInput[]
    upsert?: PersonAccessRequestUpsertWithWhereUniqueWithoutPersonInput | PersonAccessRequestUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonAccessRequestCreateManyPersonInputEnvelope
    set?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
    disconnect?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
    delete?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
    connect?: PersonAccessRequestWhereUniqueInput | PersonAccessRequestWhereUniqueInput[]
    update?: PersonAccessRequestUpdateWithWhereUniqueWithoutPersonInput | PersonAccessRequestUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonAccessRequestUpdateManyWithWhereWithoutPersonInput | PersonAccessRequestUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonAccessRequestScalarWhereInput | PersonAccessRequestScalarWhereInput[]
  }

  export type PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonAccessGrantCreateWithoutPersonInput, PersonAccessGrantUncheckedCreateWithoutPersonInput> | PersonAccessGrantCreateWithoutPersonInput[] | PersonAccessGrantUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessGrantCreateOrConnectWithoutPersonInput | PersonAccessGrantCreateOrConnectWithoutPersonInput[]
    upsert?: PersonAccessGrantUpsertWithWhereUniqueWithoutPersonInput | PersonAccessGrantUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonAccessGrantCreateManyPersonInputEnvelope
    set?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
    disconnect?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
    delete?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
    connect?: PersonAccessGrantWhereUniqueInput | PersonAccessGrantWhereUniqueInput[]
    update?: PersonAccessGrantUpdateWithWhereUniqueWithoutPersonInput | PersonAccessGrantUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonAccessGrantUpdateManyWithWhereWithoutPersonInput | PersonAccessGrantUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonAccessGrantScalarWhereInput | PersonAccessGrantScalarWhereInput[]
  }

  export type PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonAccessLogCreateWithoutPersonInput, PersonAccessLogUncheckedCreateWithoutPersonInput> | PersonAccessLogCreateWithoutPersonInput[] | PersonAccessLogUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAccessLogCreateOrConnectWithoutPersonInput | PersonAccessLogCreateOrConnectWithoutPersonInput[]
    upsert?: PersonAccessLogUpsertWithWhereUniqueWithoutPersonInput | PersonAccessLogUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonAccessLogCreateManyPersonInputEnvelope
    set?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
    disconnect?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
    delete?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
    connect?: PersonAccessLogWhereUniqueInput | PersonAccessLogWhereUniqueInput[]
    update?: PersonAccessLogUpdateWithWhereUniqueWithoutPersonInput | PersonAccessLogUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonAccessLogUpdateManyWithWhereWithoutPersonInput | PersonAccessLogUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonAccessLogScalarWhereInput | PersonAccessLogScalarWhereInput[]
  }

  export type PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput = {
    create?: XOR<PersonHrProfileCreateWithoutPersonInput, PersonHrProfileUncheckedCreateWithoutPersonInput>
    connectOrCreate?: PersonHrProfileCreateOrConnectWithoutPersonInput
    upsert?: PersonHrProfileUpsertWithoutPersonInput
    disconnect?: PersonHrProfileWhereInput | boolean
    delete?: PersonHrProfileWhereInput | boolean
    connect?: PersonHrProfileWhereUniqueInput
    update?: XOR<XOR<PersonHrProfileUpdateToOneWithWhereWithoutPersonInput, PersonHrProfileUpdateWithoutPersonInput>, PersonHrProfileUncheckedUpdateWithoutPersonInput>
  }

  export type PersonAddressUncheckedUpdateManyWithoutPersonNestedInput = {
    create?: XOR<PersonAddressCreateWithoutPersonInput, PersonAddressUncheckedCreateWithoutPersonInput> | PersonAddressCreateWithoutPersonInput[] | PersonAddressUncheckedCreateWithoutPersonInput[]
    connectOrCreate?: PersonAddressCreateOrConnectWithoutPersonInput | PersonAddressCreateOrConnectWithoutPersonInput[]
    upsert?: PersonAddressUpsertWithWhereUniqueWithoutPersonInput | PersonAddressUpsertWithWhereUniqueWithoutPersonInput[]
    createMany?: PersonAddressCreateManyPersonInputEnvelope
    set?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
    disconnect?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
    delete?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
    connect?: PersonAddressWhereUniqueInput | PersonAddressWhereUniqueInput[]
    update?: PersonAddressUpdateWithWhereUniqueWithoutPersonInput | PersonAddressUpdateWithWhereUniqueWithoutPersonInput[]
    updateMany?: PersonAddressUpdateManyWithWhereWithoutPersonInput | PersonAddressUpdateManyWithWhereWithoutPersonInput[]
    deleteMany?: PersonAddressScalarWhereInput | PersonAddressScalarWhereInput[]
  }

  export type GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutMergedIntoInput, GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput> | GlobalNaturalPersonCreateWithoutMergedIntoInput[] | GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput[]
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput | GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput[]
    upsert?: GlobalNaturalPersonUpsertWithWhereUniqueWithoutMergedIntoInput | GlobalNaturalPersonUpsertWithWhereUniqueWithoutMergedIntoInput[]
    createMany?: GlobalNaturalPersonCreateManyMergedIntoInputEnvelope
    set?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
    disconnect?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
    delete?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
    connect?: GlobalNaturalPersonWhereUniqueInput | GlobalNaturalPersonWhereUniqueInput[]
    update?: GlobalNaturalPersonUpdateWithWhereUniqueWithoutMergedIntoInput | GlobalNaturalPersonUpdateWithWhereUniqueWithoutMergedIntoInput[]
    updateMany?: GlobalNaturalPersonUpdateManyWithWhereWithoutMergedIntoInput | GlobalNaturalPersonUpdateManyWithWhereWithoutMergedIntoInput[]
    deleteMany?: GlobalNaturalPersonScalarWhereInput | GlobalNaturalPersonScalarWhereInput[]
  }

  export type PersonHrProfileCreatestatisticalCategoriesInput = {
    set: $Enums.StatisticalCategory[]
  }

  export type GlobalNaturalPersonCreateNestedOneWithoutHrProfileInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutHrProfileInput, GlobalNaturalPersonUncheckedCreateWithoutHrProfileInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutHrProfileInput
    connect?: GlobalNaturalPersonWhereUniqueInput
  }

  export type EnumBloodGroupFieldUpdateOperationsInput = {
    set?: $Enums.BloodGroup
  }

  export type NullableEnumMaritalStatusFieldUpdateOperationsInput = {
    set?: $Enums.MaritalStatus | null
  }

  export type PersonHrProfileUpdatestatisticalCategoriesInput = {
    set?: $Enums.StatisticalCategory[]
    push?: $Enums.StatisticalCategory | $Enums.StatisticalCategory[]
  }

  export type GlobalNaturalPersonUpdateOneRequiredWithoutHrProfileNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutHrProfileInput, GlobalNaturalPersonUncheckedCreateWithoutHrProfileInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutHrProfileInput
    upsert?: GlobalNaturalPersonUpsertWithoutHrProfileInput
    connect?: GlobalNaturalPersonWhereUniqueInput
    update?: XOR<XOR<GlobalNaturalPersonUpdateToOneWithWhereWithoutHrProfileInput, GlobalNaturalPersonUpdateWithoutHrProfileInput>, GlobalNaturalPersonUncheckedUpdateWithoutHrProfileInput>
  }

  export type GlobalNaturalPersonCreateNestedOneWithoutAddressesInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutAddressesInput, GlobalNaturalPersonUncheckedCreateWithoutAddressesInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutAddressesInput
    connect?: GlobalNaturalPersonWhereUniqueInput
  }

  export type EnumPersonAddressKindFieldUpdateOperationsInput = {
    set?: $Enums.PersonAddressKind
  }

  export type GlobalNaturalPersonUpdateOneRequiredWithoutAddressesNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutAddressesInput, GlobalNaturalPersonUncheckedCreateWithoutAddressesInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutAddressesInput
    upsert?: GlobalNaturalPersonUpsertWithoutAddressesInput
    connect?: GlobalNaturalPersonWhereUniqueInput
    update?: XOR<XOR<GlobalNaturalPersonUpdateToOneWithWhereWithoutAddressesInput, GlobalNaturalPersonUpdateWithoutAddressesInput>, GlobalNaturalPersonUncheckedUpdateWithoutAddressesInput>
  }

  export type GlobalNaturalPersonCreateNestedOneWithoutIdentifiersInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutIdentifiersInput, GlobalNaturalPersonUncheckedCreateWithoutIdentifiersInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutIdentifiersInput
    connect?: GlobalNaturalPersonWhereUniqueInput
  }

  export type EnumPersonIdentifierTypeFieldUpdateOperationsInput = {
    set?: $Enums.PersonIdentifierType
  }

  export type EnumIdentifierTrustFieldUpdateOperationsInput = {
    set?: $Enums.IdentifierTrust
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type GlobalNaturalPersonUpdateOneRequiredWithoutIdentifiersNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutIdentifiersInput, GlobalNaturalPersonUncheckedCreateWithoutIdentifiersInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutIdentifiersInput
    upsert?: GlobalNaturalPersonUpsertWithoutIdentifiersInput
    connect?: GlobalNaturalPersonWhereUniqueInput
    update?: XOR<XOR<GlobalNaturalPersonUpdateToOneWithWhereWithoutIdentifiersInput, GlobalNaturalPersonUpdateWithoutIdentifiersInput>, GlobalNaturalPersonUncheckedUpdateWithoutIdentifiersInput>
  }

  export type GlobalNaturalPersonCreateNestedOneWithoutAccessRequestsInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutAccessRequestsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessRequestsInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutAccessRequestsInput
    connect?: GlobalNaturalPersonWhereUniqueInput
  }

  export type EnumPersonAccessRequestStatusFieldUpdateOperationsInput = {
    set?: $Enums.PersonAccessRequestStatus
  }

  export type GlobalNaturalPersonUpdateOneRequiredWithoutAccessRequestsNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutAccessRequestsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessRequestsInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutAccessRequestsInput
    upsert?: GlobalNaturalPersonUpsertWithoutAccessRequestsInput
    connect?: GlobalNaturalPersonWhereUniqueInput
    update?: XOR<XOR<GlobalNaturalPersonUpdateToOneWithWhereWithoutAccessRequestsInput, GlobalNaturalPersonUpdateWithoutAccessRequestsInput>, GlobalNaturalPersonUncheckedUpdateWithoutAccessRequestsInput>
  }

  export type GlobalNaturalPersonCreateNestedOneWithoutAccessGrantsInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutAccessGrantsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessGrantsInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutAccessGrantsInput
    connect?: GlobalNaturalPersonWhereUniqueInput
  }

  export type GlobalNaturalPersonUpdateOneRequiredWithoutAccessGrantsNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutAccessGrantsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessGrantsInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutAccessGrantsInput
    upsert?: GlobalNaturalPersonUpsertWithoutAccessGrantsInput
    connect?: GlobalNaturalPersonWhereUniqueInput
    update?: XOR<XOR<GlobalNaturalPersonUpdateToOneWithWhereWithoutAccessGrantsInput, GlobalNaturalPersonUpdateWithoutAccessGrantsInput>, GlobalNaturalPersonUncheckedUpdateWithoutAccessGrantsInput>
  }

  export type GlobalNaturalPersonCreateNestedOneWithoutAccessLogsInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutAccessLogsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessLogsInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutAccessLogsInput
    connect?: GlobalNaturalPersonWhereUniqueInput
  }

  export type GlobalNaturalPersonUpdateOneRequiredWithoutAccessLogsNestedInput = {
    create?: XOR<GlobalNaturalPersonCreateWithoutAccessLogsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessLogsInput>
    connectOrCreate?: GlobalNaturalPersonCreateOrConnectWithoutAccessLogsInput
    upsert?: GlobalNaturalPersonUpsertWithoutAccessLogsInput
    connect?: GlobalNaturalPersonWhereUniqueInput
    update?: XOR<XOR<GlobalNaturalPersonUpdateToOneWithWhereWithoutAccessLogsInput, GlobalNaturalPersonUpdateWithoutAccessLogsInput>, GlobalNaturalPersonUncheckedUpdateWithoutAccessLogsInput>
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

  export type NestedEnumPersonSexFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonSex | EnumPersonSexFieldRefInput<$PrismaModel>
    in?: $Enums.PersonSex[] | ListEnumPersonSexFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonSex[] | ListEnumPersonSexFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonSexFilter<$PrismaModel> | $Enums.PersonSex
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

  export type NestedEnumPersonSegmentFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonSegment | EnumPersonSegmentFieldRefInput<$PrismaModel>
    in?: $Enums.PersonSegment[] | ListEnumPersonSegmentFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonSegment[] | ListEnumPersonSegmentFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonSegmentFilter<$PrismaModel> | $Enums.PersonSegment
  }

  export type NestedUuidNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidNullableFilter<$PrismaModel> | string | null
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

  export type NestedEnumPersonSexWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonSex | EnumPersonSexFieldRefInput<$PrismaModel>
    in?: $Enums.PersonSex[] | ListEnumPersonSexFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonSex[] | ListEnumPersonSexFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonSexWithAggregatesFilter<$PrismaModel> | $Enums.PersonSex
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonSexFilter<$PrismaModel>
    _max?: NestedEnumPersonSexFilter<$PrismaModel>
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

  export type NestedEnumPersonSegmentWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonSegment | EnumPersonSegmentFieldRefInput<$PrismaModel>
    in?: $Enums.PersonSegment[] | ListEnumPersonSegmentFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonSegment[] | ListEnumPersonSegmentFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonSegmentWithAggregatesFilter<$PrismaModel> | $Enums.PersonSegment
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonSegmentFilter<$PrismaModel>
    _max?: NestedEnumPersonSegmentFilter<$PrismaModel>
  }

  export type NestedUuidNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
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

  export type NestedEnumBloodGroupFilter<$PrismaModel = never> = {
    equals?: $Enums.BloodGroup | EnumBloodGroupFieldRefInput<$PrismaModel>
    in?: $Enums.BloodGroup[] | ListEnumBloodGroupFieldRefInput<$PrismaModel>
    notIn?: $Enums.BloodGroup[] | ListEnumBloodGroupFieldRefInput<$PrismaModel>
    not?: NestedEnumBloodGroupFilter<$PrismaModel> | $Enums.BloodGroup
  }

  export type NestedEnumMaritalStatusNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.MaritalStatus | EnumMaritalStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumMaritalStatusNullableFilter<$PrismaModel> | $Enums.MaritalStatus | null
  }

  export type NestedEnumBloodGroupWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.BloodGroup | EnumBloodGroupFieldRefInput<$PrismaModel>
    in?: $Enums.BloodGroup[] | ListEnumBloodGroupFieldRefInput<$PrismaModel>
    notIn?: $Enums.BloodGroup[] | ListEnumBloodGroupFieldRefInput<$PrismaModel>
    not?: NestedEnumBloodGroupWithAggregatesFilter<$PrismaModel> | $Enums.BloodGroup
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumBloodGroupFilter<$PrismaModel>
    _max?: NestedEnumBloodGroupFilter<$PrismaModel>
  }

  export type NestedEnumMaritalStatusNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.MaritalStatus | EnumMaritalStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumMaritalStatusNullableWithAggregatesFilter<$PrismaModel> | $Enums.MaritalStatus | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumMaritalStatusNullableFilter<$PrismaModel>
    _max?: NestedEnumMaritalStatusNullableFilter<$PrismaModel>
  }

  export type NestedEnumPersonAddressKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonAddressKind | EnumPersonAddressKindFieldRefInput<$PrismaModel>
    in?: $Enums.PersonAddressKind[] | ListEnumPersonAddressKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonAddressKind[] | ListEnumPersonAddressKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonAddressKindFilter<$PrismaModel> | $Enums.PersonAddressKind
  }

  export type NestedEnumPersonAddressKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonAddressKind | EnumPersonAddressKindFieldRefInput<$PrismaModel>
    in?: $Enums.PersonAddressKind[] | ListEnumPersonAddressKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonAddressKind[] | ListEnumPersonAddressKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonAddressKindWithAggregatesFilter<$PrismaModel> | $Enums.PersonAddressKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonAddressKindFilter<$PrismaModel>
    _max?: NestedEnumPersonAddressKindFilter<$PrismaModel>
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

  export type NestedEnumPersonIdentifierTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonIdentifierType | EnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    in?: $Enums.PersonIdentifierType[] | ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonIdentifierType[] | ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonIdentifierTypeFilter<$PrismaModel> | $Enums.PersonIdentifierType
  }

  export type NestedEnumIdentifierTrustFilter<$PrismaModel = never> = {
    equals?: $Enums.IdentifierTrust | EnumIdentifierTrustFieldRefInput<$PrismaModel>
    in?: $Enums.IdentifierTrust[] | ListEnumIdentifierTrustFieldRefInput<$PrismaModel>
    notIn?: $Enums.IdentifierTrust[] | ListEnumIdentifierTrustFieldRefInput<$PrismaModel>
    not?: NestedEnumIdentifierTrustFilter<$PrismaModel> | $Enums.IdentifierTrust
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedEnumPersonIdentifierTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonIdentifierType | EnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    in?: $Enums.PersonIdentifierType[] | ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonIdentifierType[] | ListEnumPersonIdentifierTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonIdentifierTypeWithAggregatesFilter<$PrismaModel> | $Enums.PersonIdentifierType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonIdentifierTypeFilter<$PrismaModel>
    _max?: NestedEnumPersonIdentifierTypeFilter<$PrismaModel>
  }

  export type NestedEnumIdentifierTrustWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.IdentifierTrust | EnumIdentifierTrustFieldRefInput<$PrismaModel>
    in?: $Enums.IdentifierTrust[] | ListEnumIdentifierTrustFieldRefInput<$PrismaModel>
    notIn?: $Enums.IdentifierTrust[] | ListEnumIdentifierTrustFieldRefInput<$PrismaModel>
    not?: NestedEnumIdentifierTrustWithAggregatesFilter<$PrismaModel> | $Enums.IdentifierTrust
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumIdentifierTrustFilter<$PrismaModel>
    _max?: NestedEnumIdentifierTrustFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedEnumPersonAccessRequestStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonAccessRequestStatus | EnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PersonAccessRequestStatus[] | ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonAccessRequestStatus[] | ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonAccessRequestStatusFilter<$PrismaModel> | $Enums.PersonAccessRequestStatus
  }

  export type NestedEnumPersonAccessRequestStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PersonAccessRequestStatus | EnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PersonAccessRequestStatus[] | ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PersonAccessRequestStatus[] | ListEnumPersonAccessRequestStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPersonAccessRequestStatusWithAggregatesFilter<$PrismaModel> | $Enums.PersonAccessRequestStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPersonAccessRequestStatusFilter<$PrismaModel>
    _max?: NestedEnumPersonAccessRequestStatusFilter<$PrismaModel>
  }

  export type PersonIdentifierCreateWithoutPersonInput = {
    id?: string
    type: $Enums.PersonIdentifierType
    issuingCountry?: string
    valueCipher: string
    blindIndex: string
    trust?: $Enums.IdentifierTrust
    isPrimary?: boolean
    createdAt?: Date | string
  }

  export type PersonIdentifierUncheckedCreateWithoutPersonInput = {
    id?: string
    type: $Enums.PersonIdentifierType
    issuingCountry?: string
    valueCipher: string
    blindIndex: string
    trust?: $Enums.IdentifierTrust
    isPrimary?: boolean
    createdAt?: Date | string
  }

  export type PersonIdentifierCreateOrConnectWithoutPersonInput = {
    where: PersonIdentifierWhereUniqueInput
    create: XOR<PersonIdentifierCreateWithoutPersonInput, PersonIdentifierUncheckedCreateWithoutPersonInput>
  }

  export type PersonIdentifierCreateManyPersonInputEnvelope = {
    data: PersonIdentifierCreateManyPersonInput | PersonIdentifierCreateManyPersonInput[]
    skipDuplicates?: boolean
  }

  export type PersonAccessRequestCreateWithoutPersonInput = {
    id?: string
    requesterOrgId: string
    purpose: string
    status?: $Enums.PersonAccessRequestStatus
    createdAt?: Date | string
    decidedAt?: Date | string | null
  }

  export type PersonAccessRequestUncheckedCreateWithoutPersonInput = {
    id?: string
    requesterOrgId: string
    purpose: string
    status?: $Enums.PersonAccessRequestStatus
    createdAt?: Date | string
    decidedAt?: Date | string | null
  }

  export type PersonAccessRequestCreateOrConnectWithoutPersonInput = {
    where: PersonAccessRequestWhereUniqueInput
    create: XOR<PersonAccessRequestCreateWithoutPersonInput, PersonAccessRequestUncheckedCreateWithoutPersonInput>
  }

  export type PersonAccessRequestCreateManyPersonInputEnvelope = {
    data: PersonAccessRequestCreateManyPersonInput | PersonAccessRequestCreateManyPersonInput[]
    skipDuplicates?: boolean
  }

  export type PersonAccessGrantCreateWithoutPersonInput = {
    id?: string
    granteeOrgId: string
    grantedAt?: Date | string
    expiresAt?: Date | string | null
  }

  export type PersonAccessGrantUncheckedCreateWithoutPersonInput = {
    id?: string
    granteeOrgId: string
    grantedAt?: Date | string
    expiresAt?: Date | string | null
  }

  export type PersonAccessGrantCreateOrConnectWithoutPersonInput = {
    where: PersonAccessGrantWhereUniqueInput
    create: XOR<PersonAccessGrantCreateWithoutPersonInput, PersonAccessGrantUncheckedCreateWithoutPersonInput>
  }

  export type PersonAccessGrantCreateManyPersonInputEnvelope = {
    data: PersonAccessGrantCreateManyPersonInput | PersonAccessGrantCreateManyPersonInput[]
    skipDuplicates?: boolean
  }

  export type PersonAccessLogCreateWithoutPersonInput = {
    id?: string
    actorOrgId: string
    action: string
    metaJson?: string | null
    createdAt?: Date | string
  }

  export type PersonAccessLogUncheckedCreateWithoutPersonInput = {
    id?: string
    actorOrgId: string
    action: string
    metaJson?: string | null
    createdAt?: Date | string
  }

  export type PersonAccessLogCreateOrConnectWithoutPersonInput = {
    where: PersonAccessLogWhereUniqueInput
    create: XOR<PersonAccessLogCreateWithoutPersonInput, PersonAccessLogUncheckedCreateWithoutPersonInput>
  }

  export type PersonAccessLogCreateManyPersonInputEnvelope = {
    data: PersonAccessLogCreateManyPersonInput | PersonAccessLogCreateManyPersonInput[]
    skipDuplicates?: boolean
  }

  export type PersonHrProfileCreateWithoutPersonInput = {
    id?: string
    bloodGroup?: $Enums.BloodGroup
    maritalStatus?: $Enums.MaritalStatus | null
    educationCipher?: string | null
    specialtyCipher?: string | null
    statisticalCategories?: PersonHrProfileCreatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonHrProfileUncheckedCreateWithoutPersonInput = {
    id?: string
    bloodGroup?: $Enums.BloodGroup
    maritalStatus?: $Enums.MaritalStatus | null
    educationCipher?: string | null
    specialtyCipher?: string | null
    statisticalCategories?: PersonHrProfileCreatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonHrProfileCreateOrConnectWithoutPersonInput = {
    where: PersonHrProfileWhereUniqueInput
    create: XOR<PersonHrProfileCreateWithoutPersonInput, PersonHrProfileUncheckedCreateWithoutPersonInput>
  }

  export type PersonAddressCreateWithoutPersonInput = {
    id?: string
    kind: $Enums.PersonAddressKind
    lineCipher: string
    cityCipher?: string | null
    regionCipher?: string | null
    postalCipher?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonAddressUncheckedCreateWithoutPersonInput = {
    id?: string
    kind: $Enums.PersonAddressKind
    lineCipher: string
    cityCipher?: string | null
    regionCipher?: string | null
    postalCipher?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonAddressCreateOrConnectWithoutPersonInput = {
    where: PersonAddressWhereUniqueInput
    create: XOR<PersonAddressCreateWithoutPersonInput, PersonAddressUncheckedCreateWithoutPersonInput>
  }

  export type PersonAddressCreateManyPersonInputEnvelope = {
    data: PersonAddressCreateManyPersonInput | PersonAddressCreateManyPersonInput[]
    skipDuplicates?: boolean
  }

  export type GlobalNaturalPersonCreateWithoutMergedFromInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressCreateNestedManyWithoutPersonInput
    mergedInto?: GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput
  }

  export type GlobalNaturalPersonUncheckedCreateWithoutMergedFromInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressUncheckedCreateNestedManyWithoutPersonInput
  }

  export type GlobalNaturalPersonCreateOrConnectWithoutMergedFromInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    create: XOR<GlobalNaturalPersonCreateWithoutMergedFromInput, GlobalNaturalPersonUncheckedCreateWithoutMergedFromInput>
  }

  export type GlobalNaturalPersonCreateWithoutMergedIntoInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressCreateNestedManyWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressUncheckedCreateNestedManyWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonCreateOrConnectWithoutMergedIntoInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    create: XOR<GlobalNaturalPersonCreateWithoutMergedIntoInput, GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput>
  }

  export type GlobalNaturalPersonCreateManyMergedIntoInputEnvelope = {
    data: GlobalNaturalPersonCreateManyMergedIntoInput | GlobalNaturalPersonCreateManyMergedIntoInput[]
    skipDuplicates?: boolean
  }

  export type PersonIdentifierUpsertWithWhereUniqueWithoutPersonInput = {
    where: PersonIdentifierWhereUniqueInput
    update: XOR<PersonIdentifierUpdateWithoutPersonInput, PersonIdentifierUncheckedUpdateWithoutPersonInput>
    create: XOR<PersonIdentifierCreateWithoutPersonInput, PersonIdentifierUncheckedCreateWithoutPersonInput>
  }

  export type PersonIdentifierUpdateWithWhereUniqueWithoutPersonInput = {
    where: PersonIdentifierWhereUniqueInput
    data: XOR<PersonIdentifierUpdateWithoutPersonInput, PersonIdentifierUncheckedUpdateWithoutPersonInput>
  }

  export type PersonIdentifierUpdateManyWithWhereWithoutPersonInput = {
    where: PersonIdentifierScalarWhereInput
    data: XOR<PersonIdentifierUpdateManyMutationInput, PersonIdentifierUncheckedUpdateManyWithoutPersonInput>
  }

  export type PersonIdentifierScalarWhereInput = {
    AND?: PersonIdentifierScalarWhereInput | PersonIdentifierScalarWhereInput[]
    OR?: PersonIdentifierScalarWhereInput[]
    NOT?: PersonIdentifierScalarWhereInput | PersonIdentifierScalarWhereInput[]
    id?: UuidFilter<"PersonIdentifier"> | string
    personId?: UuidFilter<"PersonIdentifier"> | string
    type?: EnumPersonIdentifierTypeFilter<"PersonIdentifier"> | $Enums.PersonIdentifierType
    issuingCountry?: StringFilter<"PersonIdentifier"> | string
    valueCipher?: StringFilter<"PersonIdentifier"> | string
    blindIndex?: StringFilter<"PersonIdentifier"> | string
    trust?: EnumIdentifierTrustFilter<"PersonIdentifier"> | $Enums.IdentifierTrust
    isPrimary?: BoolFilter<"PersonIdentifier"> | boolean
    createdAt?: DateTimeFilter<"PersonIdentifier"> | Date | string
  }

  export type PersonAccessRequestUpsertWithWhereUniqueWithoutPersonInput = {
    where: PersonAccessRequestWhereUniqueInput
    update: XOR<PersonAccessRequestUpdateWithoutPersonInput, PersonAccessRequestUncheckedUpdateWithoutPersonInput>
    create: XOR<PersonAccessRequestCreateWithoutPersonInput, PersonAccessRequestUncheckedCreateWithoutPersonInput>
  }

  export type PersonAccessRequestUpdateWithWhereUniqueWithoutPersonInput = {
    where: PersonAccessRequestWhereUniqueInput
    data: XOR<PersonAccessRequestUpdateWithoutPersonInput, PersonAccessRequestUncheckedUpdateWithoutPersonInput>
  }

  export type PersonAccessRequestUpdateManyWithWhereWithoutPersonInput = {
    where: PersonAccessRequestScalarWhereInput
    data: XOR<PersonAccessRequestUpdateManyMutationInput, PersonAccessRequestUncheckedUpdateManyWithoutPersonInput>
  }

  export type PersonAccessRequestScalarWhereInput = {
    AND?: PersonAccessRequestScalarWhereInput | PersonAccessRequestScalarWhereInput[]
    OR?: PersonAccessRequestScalarWhereInput[]
    NOT?: PersonAccessRequestScalarWhereInput | PersonAccessRequestScalarWhereInput[]
    id?: UuidFilter<"PersonAccessRequest"> | string
    personId?: UuidFilter<"PersonAccessRequest"> | string
    requesterOrgId?: UuidFilter<"PersonAccessRequest"> | string
    purpose?: StringFilter<"PersonAccessRequest"> | string
    status?: EnumPersonAccessRequestStatusFilter<"PersonAccessRequest"> | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFilter<"PersonAccessRequest"> | Date | string
    decidedAt?: DateTimeNullableFilter<"PersonAccessRequest"> | Date | string | null
  }

  export type PersonAccessGrantUpsertWithWhereUniqueWithoutPersonInput = {
    where: PersonAccessGrantWhereUniqueInput
    update: XOR<PersonAccessGrantUpdateWithoutPersonInput, PersonAccessGrantUncheckedUpdateWithoutPersonInput>
    create: XOR<PersonAccessGrantCreateWithoutPersonInput, PersonAccessGrantUncheckedCreateWithoutPersonInput>
  }

  export type PersonAccessGrantUpdateWithWhereUniqueWithoutPersonInput = {
    where: PersonAccessGrantWhereUniqueInput
    data: XOR<PersonAccessGrantUpdateWithoutPersonInput, PersonAccessGrantUncheckedUpdateWithoutPersonInput>
  }

  export type PersonAccessGrantUpdateManyWithWhereWithoutPersonInput = {
    where: PersonAccessGrantScalarWhereInput
    data: XOR<PersonAccessGrantUpdateManyMutationInput, PersonAccessGrantUncheckedUpdateManyWithoutPersonInput>
  }

  export type PersonAccessGrantScalarWhereInput = {
    AND?: PersonAccessGrantScalarWhereInput | PersonAccessGrantScalarWhereInput[]
    OR?: PersonAccessGrantScalarWhereInput[]
    NOT?: PersonAccessGrantScalarWhereInput | PersonAccessGrantScalarWhereInput[]
    id?: UuidFilter<"PersonAccessGrant"> | string
    personId?: UuidFilter<"PersonAccessGrant"> | string
    granteeOrgId?: UuidFilter<"PersonAccessGrant"> | string
    grantedAt?: DateTimeFilter<"PersonAccessGrant"> | Date | string
    expiresAt?: DateTimeNullableFilter<"PersonAccessGrant"> | Date | string | null
  }

  export type PersonAccessLogUpsertWithWhereUniqueWithoutPersonInput = {
    where: PersonAccessLogWhereUniqueInput
    update: XOR<PersonAccessLogUpdateWithoutPersonInput, PersonAccessLogUncheckedUpdateWithoutPersonInput>
    create: XOR<PersonAccessLogCreateWithoutPersonInput, PersonAccessLogUncheckedCreateWithoutPersonInput>
  }

  export type PersonAccessLogUpdateWithWhereUniqueWithoutPersonInput = {
    where: PersonAccessLogWhereUniqueInput
    data: XOR<PersonAccessLogUpdateWithoutPersonInput, PersonAccessLogUncheckedUpdateWithoutPersonInput>
  }

  export type PersonAccessLogUpdateManyWithWhereWithoutPersonInput = {
    where: PersonAccessLogScalarWhereInput
    data: XOR<PersonAccessLogUpdateManyMutationInput, PersonAccessLogUncheckedUpdateManyWithoutPersonInput>
  }

  export type PersonAccessLogScalarWhereInput = {
    AND?: PersonAccessLogScalarWhereInput | PersonAccessLogScalarWhereInput[]
    OR?: PersonAccessLogScalarWhereInput[]
    NOT?: PersonAccessLogScalarWhereInput | PersonAccessLogScalarWhereInput[]
    id?: UuidFilter<"PersonAccessLog"> | string
    personId?: UuidFilter<"PersonAccessLog"> | string
    actorOrgId?: UuidFilter<"PersonAccessLog"> | string
    action?: StringFilter<"PersonAccessLog"> | string
    metaJson?: StringNullableFilter<"PersonAccessLog"> | string | null
    createdAt?: DateTimeFilter<"PersonAccessLog"> | Date | string
  }

  export type PersonHrProfileUpsertWithoutPersonInput = {
    update: XOR<PersonHrProfileUpdateWithoutPersonInput, PersonHrProfileUncheckedUpdateWithoutPersonInput>
    create: XOR<PersonHrProfileCreateWithoutPersonInput, PersonHrProfileUncheckedCreateWithoutPersonInput>
    where?: PersonHrProfileWhereInput
  }

  export type PersonHrProfileUpdateToOneWithWhereWithoutPersonInput = {
    where?: PersonHrProfileWhereInput
    data: XOR<PersonHrProfileUpdateWithoutPersonInput, PersonHrProfileUncheckedUpdateWithoutPersonInput>
  }

  export type PersonHrProfileUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    bloodGroup?: EnumBloodGroupFieldUpdateOperationsInput | $Enums.BloodGroup
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationCipher?: NullableStringFieldUpdateOperationsInput | string | null
    specialtyCipher?: NullableStringFieldUpdateOperationsInput | string | null
    statisticalCategories?: PersonHrProfileUpdatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonHrProfileUncheckedUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    bloodGroup?: EnumBloodGroupFieldUpdateOperationsInput | $Enums.BloodGroup
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationCipher?: NullableStringFieldUpdateOperationsInput | string | null
    specialtyCipher?: NullableStringFieldUpdateOperationsInput | string | null
    statisticalCategories?: PersonHrProfileUpdatestatisticalCategoriesInput | $Enums.StatisticalCategory[]
    photoStorageKey?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAddressUpsertWithWhereUniqueWithoutPersonInput = {
    where: PersonAddressWhereUniqueInput
    update: XOR<PersonAddressUpdateWithoutPersonInput, PersonAddressUncheckedUpdateWithoutPersonInput>
    create: XOR<PersonAddressCreateWithoutPersonInput, PersonAddressUncheckedCreateWithoutPersonInput>
  }

  export type PersonAddressUpdateWithWhereUniqueWithoutPersonInput = {
    where: PersonAddressWhereUniqueInput
    data: XOR<PersonAddressUpdateWithoutPersonInput, PersonAddressUncheckedUpdateWithoutPersonInput>
  }

  export type PersonAddressUpdateManyWithWhereWithoutPersonInput = {
    where: PersonAddressScalarWhereInput
    data: XOR<PersonAddressUpdateManyMutationInput, PersonAddressUncheckedUpdateManyWithoutPersonInput>
  }

  export type PersonAddressScalarWhereInput = {
    AND?: PersonAddressScalarWhereInput | PersonAddressScalarWhereInput[]
    OR?: PersonAddressScalarWhereInput[]
    NOT?: PersonAddressScalarWhereInput | PersonAddressScalarWhereInput[]
    id?: UuidFilter<"PersonAddress"> | string
    personId?: UuidFilter<"PersonAddress"> | string
    kind?: EnumPersonAddressKindFilter<"PersonAddress"> | $Enums.PersonAddressKind
    lineCipher?: StringFilter<"PersonAddress"> | string
    cityCipher?: StringNullableFilter<"PersonAddress"> | string | null
    regionCipher?: StringNullableFilter<"PersonAddress"> | string | null
    postalCipher?: StringNullableFilter<"PersonAddress"> | string | null
    createdAt?: DateTimeFilter<"PersonAddress"> | Date | string
    updatedAt?: DateTimeFilter<"PersonAddress"> | Date | string
  }

  export type GlobalNaturalPersonUpsertWithoutMergedFromInput = {
    update: XOR<GlobalNaturalPersonUpdateWithoutMergedFromInput, GlobalNaturalPersonUncheckedUpdateWithoutMergedFromInput>
    create: XOR<GlobalNaturalPersonCreateWithoutMergedFromInput, GlobalNaturalPersonUncheckedCreateWithoutMergedFromInput>
    where?: GlobalNaturalPersonWhereInput
  }

  export type GlobalNaturalPersonUpdateToOneWithWhereWithoutMergedFromInput = {
    where?: GlobalNaturalPersonWhereInput
    data: XOR<GlobalNaturalPersonUpdateWithoutMergedFromInput, GlobalNaturalPersonUncheckedUpdateWithoutMergedFromInput>
  }

  export type GlobalNaturalPersonUpdateWithoutMergedFromInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUpdateManyWithoutPersonNestedInput
    mergedInto?: GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateWithoutMergedFromInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUncheckedUpdateManyWithoutPersonNestedInput
  }

  export type GlobalNaturalPersonUpsertWithWhereUniqueWithoutMergedIntoInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    update: XOR<GlobalNaturalPersonUpdateWithoutMergedIntoInput, GlobalNaturalPersonUncheckedUpdateWithoutMergedIntoInput>
    create: XOR<GlobalNaturalPersonCreateWithoutMergedIntoInput, GlobalNaturalPersonUncheckedCreateWithoutMergedIntoInput>
  }

  export type GlobalNaturalPersonUpdateWithWhereUniqueWithoutMergedIntoInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    data: XOR<GlobalNaturalPersonUpdateWithoutMergedIntoInput, GlobalNaturalPersonUncheckedUpdateWithoutMergedIntoInput>
  }

  export type GlobalNaturalPersonUpdateManyWithWhereWithoutMergedIntoInput = {
    where: GlobalNaturalPersonScalarWhereInput
    data: XOR<GlobalNaturalPersonUpdateManyMutationInput, GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoInput>
  }

  export type GlobalNaturalPersonScalarWhereInput = {
    AND?: GlobalNaturalPersonScalarWhereInput | GlobalNaturalPersonScalarWhereInput[]
    OR?: GlobalNaturalPersonScalarWhereInput[]
    NOT?: GlobalNaturalPersonScalarWhereInput | GlobalNaturalPersonScalarWhereInput[]
    id?: UuidFilter<"GlobalNaturalPerson"> | string
    finBlindIndex?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    finCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    firstNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    middleNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    lastNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    fullNameCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    phoneCipher?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    nationality?: StringNullableFilter<"GlobalNaturalPerson"> | string | null
    sex?: EnumPersonSexFilter<"GlobalNaturalPerson"> | $Enums.PersonSex
    birthDate?: DateTimeNullableFilter<"GlobalNaturalPerson"> | Date | string | null
    personSegment?: EnumPersonSegmentFilter<"GlobalNaturalPerson"> | $Enums.PersonSegment
    mergedIntoPersonId?: UuidNullableFilter<"GlobalNaturalPerson"> | string | null
    createdAt?: DateTimeFilter<"GlobalNaturalPerson"> | Date | string
    updatedAt?: DateTimeFilter<"GlobalNaturalPerson"> | Date | string
  }

  export type GlobalNaturalPersonCreateWithoutHrProfileInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogCreateNestedManyWithoutPersonInput
    addresses?: PersonAddressCreateNestedManyWithoutPersonInput
    mergedInto?: GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput
    mergedFrom?: GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUncheckedCreateWithoutHrProfileInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput
    addresses?: PersonAddressUncheckedCreateNestedManyWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonCreateOrConnectWithoutHrProfileInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    create: XOR<GlobalNaturalPersonCreateWithoutHrProfileInput, GlobalNaturalPersonUncheckedCreateWithoutHrProfileInput>
  }

  export type GlobalNaturalPersonUpsertWithoutHrProfileInput = {
    update: XOR<GlobalNaturalPersonUpdateWithoutHrProfileInput, GlobalNaturalPersonUncheckedUpdateWithoutHrProfileInput>
    create: XOR<GlobalNaturalPersonCreateWithoutHrProfileInput, GlobalNaturalPersonUncheckedCreateWithoutHrProfileInput>
    where?: GlobalNaturalPersonWhereInput
  }

  export type GlobalNaturalPersonUpdateToOneWithWhereWithoutHrProfileInput = {
    where?: GlobalNaturalPersonWhereInput
    data: XOR<GlobalNaturalPersonUpdateWithoutHrProfileInput, GlobalNaturalPersonUncheckedUpdateWithoutHrProfileInput>
  }

  export type GlobalNaturalPersonUpdateWithoutHrProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUpdateManyWithoutPersonNestedInput
    addresses?: PersonAddressUpdateManyWithoutPersonNestedInput
    mergedInto?: GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput
    mergedFrom?: GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateWithoutHrProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput
    addresses?: PersonAddressUncheckedUpdateManyWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonCreateWithoutAddressesInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileCreateNestedOneWithoutPersonInput
    mergedInto?: GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput
    mergedFrom?: GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUncheckedCreateWithoutAddressesInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonCreateOrConnectWithoutAddressesInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    create: XOR<GlobalNaturalPersonCreateWithoutAddressesInput, GlobalNaturalPersonUncheckedCreateWithoutAddressesInput>
  }

  export type GlobalNaturalPersonUpsertWithoutAddressesInput = {
    update: XOR<GlobalNaturalPersonUpdateWithoutAddressesInput, GlobalNaturalPersonUncheckedUpdateWithoutAddressesInput>
    create: XOR<GlobalNaturalPersonCreateWithoutAddressesInput, GlobalNaturalPersonUncheckedCreateWithoutAddressesInput>
    where?: GlobalNaturalPersonWhereInput
  }

  export type GlobalNaturalPersonUpdateToOneWithWhereWithoutAddressesInput = {
    where?: GlobalNaturalPersonWhereInput
    data: XOR<GlobalNaturalPersonUpdateWithoutAddressesInput, GlobalNaturalPersonUncheckedUpdateWithoutAddressesInput>
  }

  export type GlobalNaturalPersonUpdateWithoutAddressesInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUpdateOneWithoutPersonNestedInput
    mergedInto?: GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput
    mergedFrom?: GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateWithoutAddressesInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonCreateWithoutIdentifiersInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    accessRequests?: PersonAccessRequestCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressCreateNestedManyWithoutPersonInput
    mergedInto?: GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput
    mergedFrom?: GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUncheckedCreateWithoutIdentifiersInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    accessRequests?: PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressUncheckedCreateNestedManyWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonCreateOrConnectWithoutIdentifiersInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    create: XOR<GlobalNaturalPersonCreateWithoutIdentifiersInput, GlobalNaturalPersonUncheckedCreateWithoutIdentifiersInput>
  }

  export type GlobalNaturalPersonUpsertWithoutIdentifiersInput = {
    update: XOR<GlobalNaturalPersonUpdateWithoutIdentifiersInput, GlobalNaturalPersonUncheckedUpdateWithoutIdentifiersInput>
    create: XOR<GlobalNaturalPersonCreateWithoutIdentifiersInput, GlobalNaturalPersonUncheckedCreateWithoutIdentifiersInput>
    where?: GlobalNaturalPersonWhereInput
  }

  export type GlobalNaturalPersonUpdateToOneWithWhereWithoutIdentifiersInput = {
    where?: GlobalNaturalPersonWhereInput
    data: XOR<GlobalNaturalPersonUpdateWithoutIdentifiersInput, GlobalNaturalPersonUncheckedUpdateWithoutIdentifiersInput>
  }

  export type GlobalNaturalPersonUpdateWithoutIdentifiersInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessRequests?: PersonAccessRequestUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUpdateManyWithoutPersonNestedInput
    mergedInto?: GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput
    mergedFrom?: GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateWithoutIdentifiersInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessRequests?: PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUncheckedUpdateManyWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonCreateWithoutAccessRequestsInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressCreateNestedManyWithoutPersonInput
    mergedInto?: GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput
    mergedFrom?: GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUncheckedCreateWithoutAccessRequestsInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressUncheckedCreateNestedManyWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonCreateOrConnectWithoutAccessRequestsInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    create: XOR<GlobalNaturalPersonCreateWithoutAccessRequestsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessRequestsInput>
  }

  export type GlobalNaturalPersonUpsertWithoutAccessRequestsInput = {
    update: XOR<GlobalNaturalPersonUpdateWithoutAccessRequestsInput, GlobalNaturalPersonUncheckedUpdateWithoutAccessRequestsInput>
    create: XOR<GlobalNaturalPersonCreateWithoutAccessRequestsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessRequestsInput>
    where?: GlobalNaturalPersonWhereInput
  }

  export type GlobalNaturalPersonUpdateToOneWithWhereWithoutAccessRequestsInput = {
    where?: GlobalNaturalPersonWhereInput
    data: XOR<GlobalNaturalPersonUpdateWithoutAccessRequestsInput, GlobalNaturalPersonUncheckedUpdateWithoutAccessRequestsInput>
  }

  export type GlobalNaturalPersonUpdateWithoutAccessRequestsInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUpdateManyWithoutPersonNestedInput
    mergedInto?: GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput
    mergedFrom?: GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateWithoutAccessRequestsInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUncheckedUpdateManyWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonCreateWithoutAccessGrantsInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressCreateNestedManyWithoutPersonInput
    mergedInto?: GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput
    mergedFrom?: GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUncheckedCreateWithoutAccessGrantsInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput
    accessLogs?: PersonAccessLogUncheckedCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressUncheckedCreateNestedManyWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonCreateOrConnectWithoutAccessGrantsInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    create: XOR<GlobalNaturalPersonCreateWithoutAccessGrantsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessGrantsInput>
  }

  export type GlobalNaturalPersonUpsertWithoutAccessGrantsInput = {
    update: XOR<GlobalNaturalPersonUpdateWithoutAccessGrantsInput, GlobalNaturalPersonUncheckedUpdateWithoutAccessGrantsInput>
    create: XOR<GlobalNaturalPersonCreateWithoutAccessGrantsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessGrantsInput>
    where?: GlobalNaturalPersonWhereInput
  }

  export type GlobalNaturalPersonUpdateToOneWithWhereWithoutAccessGrantsInput = {
    where?: GlobalNaturalPersonWhereInput
    data: XOR<GlobalNaturalPersonUpdateWithoutAccessGrantsInput, GlobalNaturalPersonUncheckedUpdateWithoutAccessGrantsInput>
  }

  export type GlobalNaturalPersonUpdateWithoutAccessGrantsInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUpdateManyWithoutPersonNestedInput
    mergedInto?: GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput
    mergedFrom?: GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateWithoutAccessGrantsInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUncheckedUpdateManyWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonCreateWithoutAccessLogsInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressCreateNestedManyWithoutPersonInput
    mergedInto?: GlobalNaturalPersonCreateNestedOneWithoutMergedFromInput
    mergedFrom?: GlobalNaturalPersonCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonUncheckedCreateWithoutAccessLogsInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    mergedIntoPersonId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    identifiers?: PersonIdentifierUncheckedCreateNestedManyWithoutPersonInput
    accessRequests?: PersonAccessRequestUncheckedCreateNestedManyWithoutPersonInput
    accessGrants?: PersonAccessGrantUncheckedCreateNestedManyWithoutPersonInput
    hrProfile?: PersonHrProfileUncheckedCreateNestedOneWithoutPersonInput
    addresses?: PersonAddressUncheckedCreateNestedManyWithoutPersonInput
    mergedFrom?: GlobalNaturalPersonUncheckedCreateNestedManyWithoutMergedIntoInput
  }

  export type GlobalNaturalPersonCreateOrConnectWithoutAccessLogsInput = {
    where: GlobalNaturalPersonWhereUniqueInput
    create: XOR<GlobalNaturalPersonCreateWithoutAccessLogsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessLogsInput>
  }

  export type GlobalNaturalPersonUpsertWithoutAccessLogsInput = {
    update: XOR<GlobalNaturalPersonUpdateWithoutAccessLogsInput, GlobalNaturalPersonUncheckedUpdateWithoutAccessLogsInput>
    create: XOR<GlobalNaturalPersonCreateWithoutAccessLogsInput, GlobalNaturalPersonUncheckedCreateWithoutAccessLogsInput>
    where?: GlobalNaturalPersonWhereInput
  }

  export type GlobalNaturalPersonUpdateToOneWithWhereWithoutAccessLogsInput = {
    where?: GlobalNaturalPersonWhereInput
    data: XOR<GlobalNaturalPersonUpdateWithoutAccessLogsInput, GlobalNaturalPersonUncheckedUpdateWithoutAccessLogsInput>
  }

  export type GlobalNaturalPersonUpdateWithoutAccessLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUpdateManyWithoutPersonNestedInput
    mergedInto?: GlobalNaturalPersonUpdateOneWithoutMergedFromNestedInput
    mergedFrom?: GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateWithoutAccessLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    mergedIntoPersonId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUncheckedUpdateManyWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput
  }

  export type PersonIdentifierCreateManyPersonInput = {
    id?: string
    type: $Enums.PersonIdentifierType
    issuingCountry?: string
    valueCipher: string
    blindIndex: string
    trust?: $Enums.IdentifierTrust
    isPrimary?: boolean
    createdAt?: Date | string
  }

  export type PersonAccessRequestCreateManyPersonInput = {
    id?: string
    requesterOrgId: string
    purpose: string
    status?: $Enums.PersonAccessRequestStatus
    createdAt?: Date | string
    decidedAt?: Date | string | null
  }

  export type PersonAccessGrantCreateManyPersonInput = {
    id?: string
    granteeOrgId: string
    grantedAt?: Date | string
    expiresAt?: Date | string | null
  }

  export type PersonAccessLogCreateManyPersonInput = {
    id?: string
    actorOrgId: string
    action: string
    metaJson?: string | null
    createdAt?: Date | string
  }

  export type PersonAddressCreateManyPersonInput = {
    id?: string
    kind: $Enums.PersonAddressKind
    lineCipher: string
    cityCipher?: string | null
    regionCipher?: string | null
    postalCipher?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GlobalNaturalPersonCreateManyMergedIntoInput = {
    id?: string
    finBlindIndex?: string | null
    finCipher?: string | null
    firstNameCipher?: string | null
    middleNameCipher?: string | null
    lastNameCipher?: string | null
    fullNameCipher?: string | null
    phoneCipher?: string | null
    nationality?: string | null
    sex?: $Enums.PersonSex
    birthDate?: Date | string | null
    personSegment?: $Enums.PersonSegment
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonIdentifierUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumPersonIdentifierTypeFieldUpdateOperationsInput | $Enums.PersonIdentifierType
    issuingCountry?: StringFieldUpdateOperationsInput | string
    valueCipher?: StringFieldUpdateOperationsInput | string
    blindIndex?: StringFieldUpdateOperationsInput | string
    trust?: EnumIdentifierTrustFieldUpdateOperationsInput | $Enums.IdentifierTrust
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonIdentifierUncheckedUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumPersonIdentifierTypeFieldUpdateOperationsInput | $Enums.PersonIdentifierType
    issuingCountry?: StringFieldUpdateOperationsInput | string
    valueCipher?: StringFieldUpdateOperationsInput | string
    blindIndex?: StringFieldUpdateOperationsInput | string
    trust?: EnumIdentifierTrustFieldUpdateOperationsInput | $Enums.IdentifierTrust
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonIdentifierUncheckedUpdateManyWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumPersonIdentifierTypeFieldUpdateOperationsInput | $Enums.PersonIdentifierType
    issuingCountry?: StringFieldUpdateOperationsInput | string
    valueCipher?: StringFieldUpdateOperationsInput | string
    blindIndex?: StringFieldUpdateOperationsInput | string
    trust?: EnumIdentifierTrustFieldUpdateOperationsInput | $Enums.IdentifierTrust
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAccessRequestUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    requesterOrgId?: StringFieldUpdateOperationsInput | string
    purpose?: StringFieldUpdateOperationsInput | string
    status?: EnumPersonAccessRequestStatusFieldUpdateOperationsInput | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    decidedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessRequestUncheckedUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    requesterOrgId?: StringFieldUpdateOperationsInput | string
    purpose?: StringFieldUpdateOperationsInput | string
    status?: EnumPersonAccessRequestStatusFieldUpdateOperationsInput | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    decidedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessRequestUncheckedUpdateManyWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    requesterOrgId?: StringFieldUpdateOperationsInput | string
    purpose?: StringFieldUpdateOperationsInput | string
    status?: EnumPersonAccessRequestStatusFieldUpdateOperationsInput | $Enums.PersonAccessRequestStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    decidedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessGrantUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    granteeOrgId?: StringFieldUpdateOperationsInput | string
    grantedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessGrantUncheckedUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    granteeOrgId?: StringFieldUpdateOperationsInput | string
    grantedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessGrantUncheckedUpdateManyWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    granteeOrgId?: StringFieldUpdateOperationsInput | string
    grantedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PersonAccessLogUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorOrgId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    metaJson?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAccessLogUncheckedUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorOrgId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    metaJson?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAccessLogUncheckedUpdateManyWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorOrgId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    metaJson?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAddressUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    kind?: EnumPersonAddressKindFieldUpdateOperationsInput | $Enums.PersonAddressKind
    lineCipher?: StringFieldUpdateOperationsInput | string
    cityCipher?: NullableStringFieldUpdateOperationsInput | string | null
    regionCipher?: NullableStringFieldUpdateOperationsInput | string | null
    postalCipher?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAddressUncheckedUpdateWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    kind?: EnumPersonAddressKindFieldUpdateOperationsInput | $Enums.PersonAddressKind
    lineCipher?: StringFieldUpdateOperationsInput | string
    cityCipher?: NullableStringFieldUpdateOperationsInput | string | null
    regionCipher?: NullableStringFieldUpdateOperationsInput | string | null
    postalCipher?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonAddressUncheckedUpdateManyWithoutPersonInput = {
    id?: StringFieldUpdateOperationsInput | string
    kind?: EnumPersonAddressKindFieldUpdateOperationsInput | $Enums.PersonAddressKind
    lineCipher?: StringFieldUpdateOperationsInput | string
    cityCipher?: NullableStringFieldUpdateOperationsInput | string | null
    regionCipher?: NullableStringFieldUpdateOperationsInput | string | null
    postalCipher?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GlobalNaturalPersonUpdateWithoutMergedIntoInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUpdateManyWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateWithoutMergedIntoInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    identifiers?: PersonIdentifierUncheckedUpdateManyWithoutPersonNestedInput
    accessRequests?: PersonAccessRequestUncheckedUpdateManyWithoutPersonNestedInput
    accessGrants?: PersonAccessGrantUncheckedUpdateManyWithoutPersonNestedInput
    accessLogs?: PersonAccessLogUncheckedUpdateManyWithoutPersonNestedInput
    hrProfile?: PersonHrProfileUncheckedUpdateOneWithoutPersonNestedInput
    addresses?: PersonAddressUncheckedUpdateManyWithoutPersonNestedInput
    mergedFrom?: GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoNestedInput
  }

  export type GlobalNaturalPersonUncheckedUpdateManyWithoutMergedIntoInput = {
    id?: StringFieldUpdateOperationsInput | string
    finBlindIndex?: NullableStringFieldUpdateOperationsInput | string | null
    finCipher?: NullableStringFieldUpdateOperationsInput | string | null
    firstNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    middleNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    lastNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    fullNameCipher?: NullableStringFieldUpdateOperationsInput | string | null
    phoneCipher?: NullableStringFieldUpdateOperationsInput | string | null
    nationality?: NullableStringFieldUpdateOperationsInput | string | null
    sex?: EnumPersonSexFieldUpdateOperationsInput | $Enums.PersonSex
    birthDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    personSegment?: EnumPersonSegmentFieldUpdateOperationsInput | $Enums.PersonSegment
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