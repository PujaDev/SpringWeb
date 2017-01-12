var lastFrameTime = Date.now() / 1000;
var characters = {};

function init() {
  // Setup canvas and WebGL context. We pass alpha: false to canvas.getContext() so we don't use premultiplied alpha when
  // loading textures. That is handled separately by PolygonBatcher.
  var config = {alpha: false};
  characters = [
    {
      name: 'annana',
      canvas: document.getElementById("canvas-annana"),
      spineName: 'Anna_side',
      animation: 'walk',
      skin: 'clothes_1',
      speed: 1
    },
    {
      name: 'huba',
      canvas: document.getElementById("canvas-huba"),
      spineName: 'Shroom',
      animation: 'walk',
      skin: 'Poisonous',
      speed: 1
    }
  ];

  for (var index in characters) {
    var character = characters[index];
    var canvas = character.canvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    character.mvp = new spine.webgl.Matrix4();
    character.mvp.ortho2d(0, 0, canvas.width - 1, canvas.height - 1);
    character.gl = canvas.getContext("webgl", config) || canvas.getContext("experimental-webgl", config);
    character.skeletonRenderer = new spine.webgl.SkeletonRenderer(character.gl);
    character.shader = spine.webgl.Shader.newColoredTextured(character.gl);
    character.batcher = new spine.webgl.PolygonBatcher(character.gl);
    character.assetManager = new spine.webgl.AssetManager(character.gl);

    character.assetManager.loadText('assets/'+character.spineName+'.json');
    character.assetManager.loadText('assets/'+character.spineName+'.atlas');
    character.assetManager.loadTexture('assets/'+character.spineName+'.png');
  }


  requestAnimationFrame(load);
}

function load(character) {
  var loaded = true;
  for(var index in characters){
    var character = characters[index];
    // Wait until the AssetManager has loaded all resources, then load the skeletons.
    if (character.assetManager.isLoadingComplete()) {
      character.skeleton = loadSkeleton(character);
      console.log('COMPLETED '+index)
    } else {
      loaded = false;
    }
  }

  if (loaded) {
    requestAnimationFrame(render);
  } else {
    requestAnimationFrame(load);
  }

}

function loadSkeleton(character) {
  if (character.skin === undefined) skin = "default";

  // Load the texture atlas using name.atlas and name.png from the AssetManager.
  // The function passed to TextureAtlas is used to resolve relative paths.
  var atlas = new spine.TextureAtlas(character.assetManager.get("assets/" + character.spineName + ".atlas"), function (path) {
    return character.assetManager.get("assets/" + path);
  });

  // Create a AtlasAttachmentLoader that resolves region, mesh, boundingbox and path attachments
  var atlasLoader = new spine.AtlasAttachmentLoader(atlas);

  // Create a SkeletonJson instance for parsing the .json file.
  var skeletonJson = new spine.SkeletonJson(atlasLoader);

  // Set the scale to apply during parsing, parse the file, and create a new skeleton.
  var skeletonData = skeletonJson.readSkeletonData(character.assetManager.get("assets/" + character.spineName + ".json"));
  var skeleton = new spine.Skeleton(skeletonData);
  skeleton.setSkinByName(character.skin);
  var bounds = calculateBounds(skeleton);

  // Create an AnimationState, and set the initial animation in looping mode.
  var animationState = new spine.AnimationState(new spine.AnimationStateData(skeleton.data));
  animationState.setAnimation(0, character.animation, true);
  animationState.addListener({
    event: function (trackIndex, event) {
      // console.log("Event on track " + trackIndex + ": " + JSON.stringify(event));
    },
    complete: function (trackIndex, loopCount) {
      // console.log("Animation on track " + trackIndex + " completed, loop count: " + loopCount);
    },
    start: function (trackIndex) {
      // console.log("Animation on track " + trackIndex + " started");
    },
    end: function (trackIndex) {
      // console.log("Animation on track " + trackIndex + " ended");
    }
  });

  // Pack everything up and return to caller.
  return {skeleton: skeleton, state: animationState, bounds: bounds, premultipliedAlpha: false};
}

function calculateBounds(skeleton) {
  skeleton.setToSetupPose();
  skeleton.updateWorldTransform();
  var offset = new spine.Vector2();
  var size = new spine.Vector2();
  skeleton.getBounds(offset, size);
  return {offset: offset, size: size};
}

function render() {
  var now = Date.now() / 1000;
  for(var index in characters) {
    // if(index != lastIndex)
    //   continue;
    // console.log(name);
    var character = characters[index];
    var delta = (now - lastFrameTime) * character.speed;

    // Update the MVP matrix to adjust for canvas size changes
    resize(character);

    character.gl.clearColor(1, 1, 1, 0);
    // gl.clearColor(0.02745,0.0823529,0.0823529, 0);
    character.gl.clear(character.gl.COLOR_BUFFER_BIT);

    // Apply the animation state based on the delta time.
    var state = character.skeleton.state;
    var skeleton = character.skeleton.skeleton;
    var premultipliedAlpha = character.skeleton.premultipliedAlpha;
    state.update(delta);
    state.apply(skeleton);
    skeleton.updateWorldTransform();

    // Bind the shader and set the texture and model-view-projection matrix.
    character.shader.bind();
    character.shader.setUniformi(spine.webgl.Shader.SAMPLER, 0);
    character.shader.setUniform4x4f(spine.webgl.Shader.MVP_MATRIX, character.mvp.values);

    // Start the batch and tell the SkeletonRenderer to render the active skeleton.
    character.batcher.begin(character.shader);
    character.skeletonRenderer.premultipliedAlpha = premultipliedAlpha;
    character.skeletonRenderer.draw(character.batcher, skeleton);
    character.batcher.end();

    character.shader.unbind();

  }
  lastFrameTime = now;
  requestAnimationFrame(render);
}

function resize(character) {
  var canvas = character.canvas;
  var w = canvas.clientWidth;
  var h = canvas.clientHeight;
  var bounds = character.skeleton.bounds;
  if (canvas.width != w || canvas.height != h) {
    canvas.width = w;
    canvas.height = h;
  }

  // magic
  var centerX = bounds.offset.x + bounds.size.x / 2;
  var centerY = bounds.offset.y + bounds.size.y / 2;
  var scaleX = bounds.size.x / canvas.width;
  var scaleY = bounds.size.y / canvas.height;
  var scale = Math.max(scaleX, scaleY) * 1.2;
  if (scale < 1) scale = 1;
  var width = canvas.width * scale;
  var height = canvas.height * scale;

  character.mvp.ortho2d(centerX - width / 2, centerY - height / 2, width, height);
  character.gl.viewport(0, 0, canvas.width, canvas.height);
}

$(document).ready(function () {
  init();
});
