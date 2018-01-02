module.exports = {
	frag: `
precision mediump float;

uniform sampler2D uTexture;
uniform float uWindowRate;
uniform float uImageRate;
uniform bool uIsGrey;
uniform bool uIsFit;
uniform vec2 uWindow;

varying vec2 vUv;

float normpdf(in float x, in float sigma)
{
	return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
}

void main(  )
{
    vec2 customUv;
    
    // if(uIsFit){
    //     customUv = vUv;   
    // }else{
    //     if(uImageRate < uWindowRate){
    //         float winWSize = 1.0/uWindowRate; float imgWSize = 1.0/uImageRate; 
    //         customUv.x = (imgWSize-winWSize)/imgWSize/2.0 + mix( 0.0, winWSize/imgWSize, vUv.x);
    //         customUv.y = vUv.y;
    //     }else{
    //         customUv.x = vUv.x;
    //         customUv.y = (uImageRate-uWindowRate)/uImageRate/2.0 + mix( 0.0, uWindowRate/uImageRate, vUv.y);
    //     }
    // }
    customUv = vUv;   
    
	vec3 c = texture2D(uTexture, customUv).rgb;
		
		//declare stuff
		const int mSize = 11;
		const int kSize = (mSize-1)/2;
		float kernel[mSize];
		vec3 final_colour = vec3(0.0);
		
		//create the 1-D kernel
		float sigma = 7.0;
		float Z = 0.0;
		for (int j = 0; j <= kSize; ++j)
		{
			kernel[kSize+j] = kernel[kSize-j] = normpdf(float(j), sigma);
		}
		
		//get the normalization factor (as the gaussian has been clamped)
		for (int j = 0; j < mSize; ++j)
		{
			Z += kernel[j];
		}
		
		//read out the texels
		for (int i=-kSize; i <= kSize; ++i)
		{
			for (int j=-kSize; j <= kSize; ++j)
			{
				final_colour += kernel[kSize+j]*kernel[kSize+i]*texture2D(uTexture, customUv + (vec2(float(i),float(j))) / uWindow.xy).rgb;
			}
		}
		
		
		gl_FragColor = vec4(final_colour/(Z*Z), 1.0);
	
}`
};
