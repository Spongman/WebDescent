attribute vec3 aVertexPosition;
attribute vec2 aVertexTextureCoord;
attribute vec3 aVertexLight;
attribute float aVertexBrightness;

uniform mat4 matProjection;
uniform mat4 matModelView;
uniform vec2 slide;
uniform float alpha;

uniform mat3 matOrientTex2;

varying vec2 vTextureCoord;
varying vec2 vTextureCoord2;
varying vec4 vColor;

void main(void)
{
	gl_Position = matProjection * matModelView * vec4(aVertexPosition, 1.0);

	vTextureCoord = aVertexTextureCoord + slide;
	vTextureCoord2 = (matOrientTex2 * vec3(aVertexTextureCoord, 1)).xy + slide;

	vColor = vec4(aVertexLight + vec3(aVertexBrightness), alpha);
}