precision mediump float;

uniform sampler2D sampTexture;
uniform sampler2D sampPalette;

varying vec2 vTextureCoord;

void main(void)
{
	float index = texture2D (sampTexture, vTextureCoord).x;
	vec4 rgb = texture2D (sampPalette, vec2 (index, 0));
	gl_FragColor = rgb;

	if(gl_FragColor.a < 1.0/256.0)
		discard;
}