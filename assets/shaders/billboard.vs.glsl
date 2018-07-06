attribute vec2 aVertexPosition;

uniform mat4 matModelView;
uniform mat4 matProjection;
uniform vec2 sizeTexture;
uniform float scale;
uniform vec3 pos;

varying vec2 vTextureCoord;

void main(void)
{
	vTextureCoord = aVertexPosition;

	gl_Position = matProjection * (
		matModelView * vec4(pos, 1.0) +
		vec4((1.0 - (aVertexPosition * 2.0)) * sizeTexture, 0.0, 0.0) * scale
	);
}