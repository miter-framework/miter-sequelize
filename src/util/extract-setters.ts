

export function extractSetters(obj: any) {
    let prototypes = [];
    let p = obj;
    while (!!p && p.constructor !== Object) {
        prototypes.push(p);
        p = Object.getPrototypeOf(p);
    }
    let setters = new Set<string>();
    for (let p of prototypes) {
        let props: {[key: string]: TypedPropertyDescriptor<any>} & { [key: string]: PropertyDescriptor } = (<any>Object).getOwnPropertyDescriptors(p);
        for (let name of Object.keys(props)) {
            let prop = props[name];
            if (typeof prop.set === 'function') setters.add(name);
        }
    }
    return Array.from(setters);
}
