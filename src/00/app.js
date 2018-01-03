const dat = require('dat.gui/build/dat.gui');
const TweenMax = require('gsap');
const Stats = require('stats.js');
import imageURL from '../assets/image.jpg';
import uvImageURL from '../assets/uv_img.jpg';

import { Program, ArrayBuffer, Texture, FrameBuffer } from 'tubugl-core';

const vertexShader = `// an attribute will receive data from a buffer
  precision mediump float;
  
  attribute vec4 position;
  uniform float uTheta;
  uniform float uWindowRate;
  
  varying vec2 vUv;

  void main() {
    float x = mix(-1., 1.0 + uWindowRate * 2.0, position.x);
    float y = mix(-1., 1.0 + 1.0/uWindowRate * 2.0, position.y);
    float uvX = mix(0., 1.0 + uWindowRate, position.x);
    float uvY = 1.0 - mix(0., 1.0 + 1.0/uWindowRate, position.y);
    
    gl_Position = vec4(x, y, position.z, 1.0);
    
    vUv = vec2(uvX, uvY);
  }`;

const fragmentShader = `
  precision mediump float;
  
  varying vec2 vUv;
  
  uniform sampler2D uTexture;
  uniform float uWindowRate;
  uniform float uImageRate;
  uniform bool uIsGrey;
  uniform bool uIsFit;

  void main() {
    vec2 customUv;
    
    if(uIsFit){
        customUv = vUv;   
    }else{
        if(uImageRate < uWindowRate){
            float winWSize = 1.0/uWindowRate; float imgWSize = 1.0/uImageRate; 
            customUv.x = (imgWSize-winWSize)/imgWSize/2.0 + mix( 0.0, winWSize/imgWSize, vUv.x);
            customUv.y = vUv.y;
        }else{
            customUv.x = vUv.x;
            customUv.y = (uImageRate-uWindowRate)/uImageRate/2.0 + mix( 0.0, uWindowRate/uImageRate, vUv.y);
        }
    }
    
	vec4 color;
	
	
    
	color = texture2D( uTexture, customUv);
    
    gl_FragColor = color;
  }
`;

const gausianBlur = require('./gausian-blur');
const fastGausianBlur = require('./fast-gausian-blur');

export default class App {
	constructor(params = {}) {
		this._width = params.width ? params.width : window.innerWidth;
		this._height = params.height ? params.height : window.innerHeight;

		this.canvas = document.createElement('canvas');
		this.gl = this.canvas.getContext('webgl');

		this._isUVImage = false;
		this._state = 'fast-blur'; //'gausin-blur';

		if (params.isDebug) {
			this.stats = new Stats();
			document.body.appendChild(this.stats.dom);
			this._addGui();
		} else {
			let descId = document.getElementById('tubugl-desc');
			descId.style.display = 'none';
		}

		this._createProgram();
		this.resize(this._width, this._height);
	}

	_addGui() {
		this.gui = new dat.GUI();
		this.playAndStopGui = this.gui.add(this, '_playAndStop').name('pause');

		this.gui
			.add(this, '_isUVImage')
			.name('isUVImage')
			.onChange(() => {
				let image = this._isUVImage ? this._uvimage : this._image;
				this._texture
					.bind()
					.setFilter()
					.wrap()
					.fromImage(image, image.width, image.height);
			});

		this.gui.add(this, '_state', ['gausin-blur', 'fast-blur']);
	}

	_createProgram() {
		this._program = new Program(this.gl, vertexShader, gausianBlur.frag);

		let vertices = new Float32Array([0, 0, 1, 0, 0, 1]);

		this._arrayBuffer = new ArrayBuffer(this.gl, vertices);
		this._arrayBuffer.setAttribs('position', 2, this.gl.FLOAT, false, 0, 0);

		this._obj = {
			program: this._program,
			positionBuffer: this._arrayBuffer,
			count: 3
		};

		let frontFramebuffer = new FrameBuffer(this.gl, {}, window.innerWidth, window.innerHeight);
		frontFramebuffer.unbind();
		let backFramebuffer = new FrameBuffer(this.gl, {}, window.innerWidth, window.innerHeight);
		backFramebuffer.unbind();
		this._framebuffers = {
			front: frontFramebuffer,
			back: backFramebuffer,
			read: frontFramebuffer,
			write: backFramebuffer
		};

		this._fastBlurProgram = new Program(this.gl, vertexShader, fastGausianBlur.frag);

		this._fastBlurObj = {
			program: this._fastBlurProgram,
			positionBuffer: this._arrayBuffer,
			count: 3
		};
	}

	animateIn() {
		this._startLoad();
	}

	loop() {
		if (this.stats) this.stats.update();
		this.gl.viewport(0, 0, this._width, this._height);

		if (this._state === 'gausin-blur') {
			this._drawBlur();
		} else {
			this._drawFastBlur();
		}
	}
	_drawFastBlur() {
		var iterations = 8;

		if (!this._time) this._time = 1 / 60;
		else this._time += 1 / 60;
		let anim = (Math.cos(this._time) + 1) / 2;

		this._fastBlurObj.program.bind();
		for (var ii = 0; ii < iterations; ii++) {
			var radius = iterations - ii - 1;
			radius *= anim;

			if (ii == iterations - 1) this._framebuffers.write.unbind();
			else this._framebuffers.write.bind();

			if (ii == 0) {
				this._fastBlurObj.program.setUniformTexture(this._texture, 'uTexture');
				this._texture.activeTexture().bind();
			} else {
				this._fastBlurObj.program.setUniformTexture(
					this._framebuffers.read.texture,
					'uTexture'
				);
				this._framebuffers.read.texture.activeTexture().bind();
			}
			this._fastBlurObj.positionBuffer.bind().attribPointer(this._fastBlurObj.program);

			this.gl.uniform2f(
				this._fastBlurObj.program.getUniforms('uWindow').location,
				this._width,
				this._height
			);
			if (ii % 2 == 1)
				this.gl.uniform2f(
					this._fastBlurObj.program.getUniforms('uDirection').location,
					radius,
					0
				);
			else
				this.gl.uniform2f(
					this._fastBlurObj.program.getUniforms('uDirection').location,
					0,
					radius
				);

			if (ii == iterations - 1 && (iterations - 1) % 2 == 1)
				this.gl.uniform1f(this._fastBlurObj.program.getUniforms('uFlip').location, true);
			else this.gl.uniform1f(this._fastBlurObj.program.getUniforms('uFlip').location, false);

			this.gl.drawArrays(this.gl.TRIANGLES, 0, this._fastBlurObj.count);

			if (this._framebuffers.read == this._framebuffers.front) {
				this._framebuffers.read = this._framebuffers.back;
				this._framebuffers.write = this._framebuffers.front;
			} else {
				this._framebuffers.read = this._framebuffers.front;
				this._framebuffers.write = this._framebuffers.back;
			}
		}
	}
	_drawBlur() {
		this._obj.program.bind();
		this._obj.program.setUniformTexture(this._texture, 'uTexture');
		this._texture.activeTexture().bind();
		this._obj.positionBuffer.bind().attribPointer(this._obj.program);

		this.gl.drawArrays(this.gl.TRIANGLES, 0, this._obj.count);
	}
	animateOut() {
		TweenMax.ticker.removeEventListener('tick', this.loop, this);
	}

	onMouseMove(mouse) {}

	onKeyDown(ev) {
		switch (ev.which) {
			case 27:
				this._playAndStop();
				break;
		}
	}

	_onload() {
		this._texture = new Texture(this.gl);
		this._texture
			.bind()
			.setFilter()
			.wrap()
			.fromImage(this._image, this._image.width, this._image.height);

		this._playAndStop();
	}

	_startLoad() {
		this._image = new Image();
		this._image.onload = this._onload.bind(this);
		this._image.onerror = function() {
			console.error('image load error');
		};
		this._image.src = imageURL;

		this._uvimage = new Image();
		this._uvimage.onerror = function() {
			console.error('image load error');
		};
		this._uvimage.src = uvImageURL;
	}

	_playAndStop() {
		this.isLoop = !this.isLoop;
		if (this.isLoop) {
			TweenMax.ticker.addEventListener('tick', this.loop, this);
			if (this.playAndStopGui) this.playAndStopGui.name('pause');
		} else {
			TweenMax.ticker.removeEventListener('tick', this.loop, this);
			if (this.playAndStopGui) this.playAndStopGui.name('play');
		}
	}

	resize(width, height) {
		this._width = width;
		this._height = height;

		this.canvas.width = this._width;
		this.canvas.height = this._height;
		this.gl.viewport(0, 0, this._width, this._height);

		this._obj.program.bind();
		this.gl.uniform1f(
			this._program.getUniforms('uWindowRate').location,
			this._height / this._width
		);
		this.gl.uniform2f(this._program.getUniforms('uWindow').location, this._width, this._height);

		this._fastBlurObj.program.bind();
		this.gl.uniform1f(
			this._fastBlurObj.program.getUniforms('uWindowRate').location,
			this._height / this._width
		);
		this.gl.uniform2f(
			this._fastBlurObj.program.getUniforms('uWindow').location,
			this._width,
			this._height
		);
	}

	destroy() {}
}
