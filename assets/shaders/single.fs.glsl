#define DEBUG 0

precision mediump float;

uniform sampler2D sampTexture;
uniform sampler2D sampPalette;

varying vec2 vTextureCoord;
varying vec4 vColor;

#if DEBUG
varying vec4 vPosition;
uniform vec3 leftPlaneAnchor, leftPlaneNormal;
uniform vec3 rightPlaneAnchor, rightPlaneNormal;
uniform vec3 bottomPlaneAnchor, bottomPlaneNormal;
uniform vec3 topPlaneAnchor, topPlaneNormal;
#endif

void main(void)
{
	float index = texture2D (sampTexture, vTextureCoord).x;
	vec4 rgb = texture2D (sampPalette, vec2 (index, 0));
	gl_FragColor = rgb * vColor;

	#if DEBUG
	if (dot ((vPosition.xyz - leftPlaneAnchor), leftPlaneNormal) < 0.0)
		gl_FragColor.r += 1.0-clamp(-15.0*dot (normalize(vPosition.xyz - leftPlaneAnchor), normalize(leftPlaneNormal)),0.0,1.00);
	if (dot ((vPosition.xyz - rightPlaneAnchor), rightPlaneNormal) < 0.0)
		gl_FragColor.g += 1.0-clamp(-15.0*dot (normalize(vPosition.xyz - rightPlaneAnchor), normalize(rightPlaneNormal)),0.0,1.00);

	if (dot ((vPosition.xyz - bottomPlaneAnchor), bottomPlaneNormal) < 0.0)
		gl_FragColor.b += 1.0-clamp(-15.0*dot (normalize(vPosition.xyz - bottomPlaneAnchor), normalize(bottomPlaneNormal)),0.0,1.00);

	if (dot ((vPosition.xyz - topPlaneAnchor), topPlaneNormal) < 0.0)
		gl_FragColor.rg += 1.0-clamp(-15.0*dot (normalize(vPosition.xyz - topPlaneAnchor), normalize(topPlaneNormal)),0.0,1.00);
	#endif
}