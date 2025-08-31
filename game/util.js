function lerp(a, b, t) {
    return (1 - t) * a + b * t;
}

function clamp(a, min, max) {
    if (a < (min || 0))
        return min || 0;
    if (a > (max || 1))
        return max || 1;
    return a;
}

function smoothstep(x) {
   return x * x * (3.0 - 2.0 * x);
}

function smootherstep(x) {
    return x * x * x * (x * (6 * x - 15) + 10);
}