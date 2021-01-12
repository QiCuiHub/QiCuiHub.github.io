const fragment = `
/* Adapted from http://andrewthall.org/papers/df64_qf128.pdf */

#define TWOPI 6.28318530718
#define INVERSE_LN2 1.44269504089

uniform vec2 scale;
uniform vec2 offset;
uniform vec4 center;
uniform vec2 zero;
uniform float iterations;

vec2 df64_add(vec2 a, vec2 b){
    vec2 s = (a + b) + zero; // Stop compiler optimization
    vec2 v = (s - a) + zero; // Stop compiler optimization
    vec2 e = (a - (s - v)) + (b - v);

    return vec2(s.x, e.x + s.y + e.y);
}

vec2 df64_mult(vec2 a, vec2 b){
    float hi = a.x * b.x;
    float lo = a.y * b.y + a.x * b.y + a.y * b.x;

    float s = (hi + lo) + zero.x; // Stop compiler optimization
    float e = lo - (s - hi);

    return vec2(s, e);
}

vec3 get_color(float v, float c){
    float x = v / c * TWOPI;

    float R = cos(x * 5.8);
    float G = cos(x * 5.5);
    float B = cos(x * 5.2);

    return 0.5 - vec3(R, G, B) * 0.5;
}

void main() {

    vec4 z = vec4(0.0);
    float log_zn = 0.0;

    // center + (gl_FragCoord.xy - offset) * scale
    vec4 f = vec4(gl_FragCoord.x - offset.x, 0.0, gl_FragCoord.y - offset.y, 0.0);
    vec4 s = vec4(df64_mult(f.xy, scale), df64_mult(f.zw, scale));
    vec4 c = vec4(df64_add(center.xy, s.xy), df64_add(center.zw, s.zw));  
  
    vec3 color = vec3(0.0);
    float iter = 0.0;
    float frac = 0.0;

    for(int i = 0; i < 8192; i ++)
    {
        if (iter > iterations) break;

        // Real
        vec2 real = df64_add(
             df64_mult(z.xy, z.xy),
            -df64_mult(z.zw, z.zw)
        );

        // Complex
        vec2 complex = df64_mult(
            vec2(2.0, 0.0),
            df64_mult(z.zw, z.xy)
        );

        // z' = (z.z * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        z = vec4(df64_add(real, c.xy), df64_add(complex, c.zw));
        log_zn = log(z.x * z.x + z.z * z.z);

        // Smoothed escape time coloring
        if (log_zn >= 4.0) {
            frac = iter - log(log_zn) * INVERSE_LN2;
            color = get_color(frac, iterations);
            break;
        }

        iter += 1.0;
    }

    gl_FragColor = vec4(color, 1.0);
}

`;

const vertex = `

precision highp float;

attribute vec2 aVertexPosition;

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;


void main() {
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}

`;
