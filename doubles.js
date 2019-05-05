let split = (a) => {
    let hi = Math.fround(a);
    let lo = a - hi;
    
    return [hi, lo];
}