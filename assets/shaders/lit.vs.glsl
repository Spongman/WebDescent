attribute vec3 aVertexPosition;
attribute vec2 aVertexTextureCoord;

uniform mat4 matProjection;
uniform mat4 matModelView;

varying vec2 vTextureCoord;

void main(void)
{
	gl_Position = matProjection * matModelView * vec4(aVertexPosition, 1.0);
	vTextureCoord = aVertexTextureCoord;
}