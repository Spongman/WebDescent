precision mediump float;

varying vec3 vColor;

uniform vec3 light;

void main(void)
{
	gl_FragColor = vec4(vColor * light,1);
}