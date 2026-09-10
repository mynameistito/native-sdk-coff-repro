export interface Model {
  readonly count: number;
}

export type Msg =
  | { readonly kind: "increment" }
  | { readonly kind: "reset" };

export function initialModel(): Model {
  return { count: 0 };
}

export function update(model: Model, msg: Msg): Model {
  switch (msg.kind) {
    case "increment":
      return { count: model.count < 100 ? model.count + 1 : model.count };
    case "reset":
      return { count: 0 };
  }
}
