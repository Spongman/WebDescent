#define DEBUG 0

attribute vec3 aVertexPosition;
attribute vec3 aVertexLight;
attribute float aVertexBrightness;
attribute vec2 aVertexTextureCoord;

uniform mat4 matProjection;
uniform mat4 matModelView;
uniform vec2 slide;
uniform float alpha;

varying vec2 vTextureCoord;
varying vec4 vColor;
#if DEBUG
varying vec4 vPosition;
#endif

void main(void)
{
	gl_Position = matProjection * matModelView * vec4(aVertexPosition, 1.0);
	vTextureCoord = aVertexTextureCoord + slide;

	vColor = vec4(aVertexLight + vec3(aVertexBrightness),alpha);

	#if DEBUG
	vPosition = vec4(aVertexPosition,1);
	#endif
}