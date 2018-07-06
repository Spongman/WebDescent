attribute vec3 aVertexPosition;
attribute vec3 aVertexColor;

uniform mat4 matModelView;
uniform mat4 matProjection;

varying vec3 vColor;

void main(void)
{
	gl_Position = matProjection * matModelView * vec4(aVertexPosition, 1.0);
	vColor = aVertexColor;
}