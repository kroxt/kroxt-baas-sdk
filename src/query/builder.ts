import { QueryCondition, QueryOperator, SortOrder, Document } from "../types";

export class QueryBuilder<T = Record<string, any>> {
  private conditions: QueryCondition[] = [];
  private sortField?: string;
  private sortDir?: SortOrder;
  private limitVal?: number;
  private skipVal?: number;
  private selectedFields?: string[];

  // Callback to execute the query against the backend REST endpoint
  private executeFn: (compiledParams: Record<string, any>) => Promise<Document<T>[]>;

  constructor(executeFn: (compiledParams: Record<string, any>) => Promise<Document<T>[]>) {
    this.executeFn = executeFn;
  }

  /**
   * Adds a filter condition.
   * Usage:
   * .where("category", "Programming") // implicit equals
   * .where("views", "greaterThan", 100)
   */
  public where(field: string, value: any): this;
  public where(field: string, operator: QueryOperator, value: any): this;
  public where(field: string, opOrValue: any, value?: any): this {
    if (value === undefined) {
      this.conditions.push({ field, operator: "equals", value: opOrValue });
    } else {
      this.conditions.push({ field, operator: opOrValue, value });
    }
    return this;
  }

  public equals(field: string, value: any): this {
    return this.where(field, "equals", value);
  }

  public notEquals(field: string, value: any): this {
    return this.where(field, "notEquals", value);
  }

  public greaterThan(field: string, value: any): this {
    return this.where(field, "greaterThan", value);
  }

  public lessThan(field: string, value: any): this {
    return this.where(field, "lessThan", value);
  }

  public in(field: string, value: any[]): this {
    return this.where(field, "in", value);
  }

  public notIn(field: string, value: any[]): this {
    return this.where(field, "notIn", value);
  }

  public contains(field: string, value: string): this {
    return this.where(field, "contains", value);
  }

  public startsWith(field: string, value: string): this {
    return this.where(field, "startsWith", value);
  }

  public endsWith(field: string, value: string): this {
    return this.where(field, "endsWith", value);
  }

  /**
   * Sorts the records by field name.
   */
  public orderBy(field: string, direction: SortOrder = "asc"): this {
    this.sortField = field;
    this.sortDir = direction;
    return this;
  }

  /**
   * Limits the number of returned records.
   */
  public limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  /**
   * Skips a number of records.
   */
  public skip(n: number): this {
    this.skipVal = n;
    return this;
  }

  /**
   * Projects selected fields from the resulting query.
   */
  public select(fields: string[] | string): this {
    this.selectedFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  /**
   * Compiles the builder configuration into REST API parameters.
   */
  public compile(): Record<string, any> {
    const params: Record<string, any> = {};

    if (this.limitVal !== undefined) {
      params.limit = String(this.limitVal);
    }
    if (this.skipVal !== undefined) {
      params.skip = String(this.skipVal);
    }
    if (this.sortField) {
      params.sort = this.sortDir === "desc" ? `-${this.sortField}` : this.sortField;
    }
    if (this.selectedFields && this.selectedFields.length > 0) {
      params.select = this.selectedFields.join(",");
    }

    // Compile filter conditions
    for (const cond of this.conditions) {
      const { field, operator, value } = cond;
      
      switch (operator) {
        case "equals":
          params[field] = value;
          break;
        case "notEquals":
          params[`${field}[$ne]`] = value;
          break;
        case "greaterThan":
          params[`${field}[$gt]`] = value;
          break;
        case "lessThan":
          params[`${field}[$lt]`] = value;
          break;
        case "in":
          params[`${field}[$in]`] = Array.isArray(value) ? value.join(",") : value;
          break;
        case "notIn":
          params[`${field}[$nin]`] = Array.isArray(value) ? value.join(",") : value;
          break;
        case "contains":
          params[`${field}[$regex]`] = value;
          params[`${field}[$options]`] = "i";
          break;
        case "startsWith":
          params[`${field}[$regex]`] = `^${value}`;
          params[`${field}[$options]`] = "i";
          break;
        case "endsWith":
          params[`${field}[$regex]`] = `${value}$`;
          params[`${field}[$options]`] = "i";
          break;
      }
    }

    return params;
  }

  /**
   * Executes the compiled query.
   */
  public async get(): Promise<Document<T>[]> {
    return this.executeFn(this.compile());
  }
}
