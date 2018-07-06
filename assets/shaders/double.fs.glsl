precision mediump float;

uniform sampler2D sampTexture1;
uniform sampler2D sampTexture2;
uniform sampler2D sampPalette;

varying vec2 vTextureCoord;
varying vec2 vTextureCoord2;
varying vec4 vColor;

void main(void)
{
	float index = texture2D (sampTexture2, vTextureCoord2).x;

	if (index >= 254.0/256.0)
	{
		if (index >= 255.0/256.0)
			index = texture2D (sampTexture1, vTextureCoord).x;
		else
			discard;
	}

	vec4 rgb = texture2D (sampPalette, vec2 (index, 0));
	gl_FragColor = rgb * vColor;
}