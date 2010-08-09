// Marching cubes in Javascript
//
// Yes, this is madness. But this should test those JS engines!
// Does not do simple optimizations like vertex sharing. Nevertheless,
// performance is quite acceptable on Chrome.
//
// Converted from the standard C implementation that's all over the web.

function MarchingCubesEffect() {
  var arrays = tdl.primitives.createCube(1.0)
  // var program = createProgramFromTags("spinning_cube_vs", "spinning_cube_fs")
  var program = createProgramFromTags("marching_cube_vs", "marching_cube_fs")
  var textures = []

  var proj = new Float32Array(16)
  var view = new Float32Array(16)
  var world = new Float32Array(16)

  var viewproj = new Float32Array(16)
  var worldviewproj = new Float32Array(16)

  var model = new tdl.models.Model(program, arrays, textures);

  var eyePosition = new Float32Array([0, 0, 1.7])
  var target = new Float32Array([0.3, 0, 0])

  // Size of field. 32 is pushing it in Javascript :)
  var size = 32
  // Deltas
  var delta = 2.0 / size
  var yd = size
  var zd = size * size

  var field = new Float32Array(size * size * size)
  var normal_cache = new Float32Array(size * size * size * 3)

  var m4 = tdl.fast.matrix4

  // Temp buffer used in polygonize
  var vlist = new Float32Array(12 * 3)
  var nlist = new Float32Array(12 * 3)

  m4.perspective(proj, tdl.math.degToRad(60), aspect, 0.1, 500);
  m4.lookAt(view, eyePosition, target, up);

  function lerp(a,b,t) { return a + (b - a) * t; }
  function VIntX(q,pout,nout,offset,isol,x,y,z,valp1,valp2) {
    var mu = (isol - valp1) / (valp2 - valp1);
    pout[offset + 0] = x + mu * delta;
    pout[offset + 1] = y;
    pout[offset + 2] = z;
    nout[offset + 0] = lerp(normal_cache[q],   normal_cache[q+3], mu)
    nout[offset + 1] = lerp(normal_cache[q+1], normal_cache[q+4], mu)
    nout[offset + 2] = lerp(normal_cache[q+2], normal_cache[q+5], mu)
  }
  function VIntY(q,pout,nout,offset,isol,x,y,z,valp1,valp2) {
    var mu = (isol - valp1) / (valp2 - valp1);
    pout[offset + 0] = x;
    pout[offset + 1] = y + mu * delta;
    pout[offset + 2] = z;
    var q2 = q + yd*3
    nout[offset + 0] = lerp(normal_cache[q],   normal_cache[q2], mu)
    nout[offset + 1] = lerp(normal_cache[q+1], normal_cache[q2+1], mu)
    nout[offset + 2] = lerp(normal_cache[q+2], normal_cache[q2+2], mu)
  }
  function VIntZ(q,pout,nout,offset,isol,x,y,z,valp1,valp2) {
    var mu = (isol - valp1) / (valp2 - valp1);
    pout[offset + 0] = x;
    pout[offset + 1] = y;
    pout[offset + 2] = z + mu * delta
    var q2 = q + zd*3
    nout[offset + 0] = lerp(normal_cache[q],   normal_cache[q2], mu)
    nout[offset + 1] = lerp(normal_cache[q+1], normal_cache[q2+1], mu)
    nout[offset + 2] = lerp(normal_cache[q+2], normal_cache[q2+2], mu)
  }

  function compNorm(q) {
    if (normal_cache[q*3] == 0.0) {
      normal_cache[q*3    ] = field[q-1]  - field[q+1]
      normal_cache[q*3 + 1] = field[q-yd] - field[q+yd]
      normal_cache[q*3 + 2] = field[q-zd] - field[q+zd]
    }
  }

  // Returns total number of triangles. Fills triangles.
  // TODO: Optimize to death, add normal calculations so that we can run
  // proper lighting shaders on the results. The grid parameter should be
  // implicit and removed.
  function polygonize(fx, fy, fz, q, isol) {
    var cubeindex = 0;
    var field0 = field[q]
    var field1 = field[q+1]
    var field2 = field[q+yd]
    var field3 = field[q+1+yd]
    var field4 = field[q+zd]
    var field5 = field[q+1+zd]
    var field6 = field[q+yd+zd]
    var field7 = field[q+1+yd+zd]
    if (field0 < isol) cubeindex |= 1;
    if (field1 < isol) cubeindex |= 2;
    if (field2 < isol) cubeindex |= 8;
    if (field3 < isol) cubeindex |= 4;
    if (field4 < isol) cubeindex |= 16;
    if (field5 < isol) cubeindex |= 32;
    if (field6 < isol) cubeindex |= 128;
    if (field7 < isol) cubeindex |= 64;

    // If cube is entirely in/out of the surface - bail, nothing to draw.
    var bits = edgeTable[cubeindex]
    if (bits == 0) return 0;

    var d = 2.0 / size;
    var fx2 = fx + d, fy2 = fy + d, fz2 = fz + d

    // Top of the cube
    if (bits & 1)    {compNorm(q);       compNorm(q+1);       VIntX(q*3,      vlist, nlist, 0, isol, fx,  fy,  fz, field0, field1); }
    if (bits & 2)    {compNorm(q+1);     compNorm(q+1+yd);    VIntY((q+1)*3,  vlist, nlist, 3, isol, fx2, fy,  fz, field1, field3); }
    if (bits & 4)    {compNorm(q+yd);    compNorm(q+1+yd);    VIntX((q+yd)*3, vlist, nlist, 6, isol, fx,  fy2, fz, field2, field3); }
    if (bits & 8)    {compNorm(q);       compNorm(q+yd);      VIntY(q*3,      vlist, nlist, 9, isol, fx,  fy,  fz, field0, field2); }
    // Bottom of the cube
    if (bits & 16)   {compNorm(q+zd);    compNorm(q+1+zd);    VIntX((q+zd)*3,    vlist, nlist, 12, isol, fx,  fy,  fz2, field4, field5); }
    if (bits & 32)   {compNorm(q+1+zd);  compNorm(q+1+yd+zd); VIntY((q+1+zd)*3,  vlist, nlist, 15, isol, fx2, fy,  fz2, field5, field7); }
    if (bits & 64)   {compNorm(q+yd+zd); compNorm(q+1+yd+zd); VIntX((q+yd+zd)*3, vlist, nlist, 18, isol, fx,  fy2, fz2, field6, field7); }
    if (bits & 128)  {compNorm(q+zd);    compNorm(q+yd+zd);   VIntY((q+zd)*3,    vlist, nlist, 21, isol, fx,  fy,  fz2, field4, field6); }
    // Vertical lines of the cube
    if (bits & 256)  {compNorm(q);       compNorm(q+zd);      VIntZ(q*3,        vlist, nlist, 24, isol, fx,  fy,  fz, field0, field4); }
    if (bits & 512)  {compNorm(q+1);     compNorm(q+1+zd);    VIntZ((q+1)*3,    vlist, nlist, 27, isol, fx2, fy,  fz, field1, field5); }
    if (bits & 1024) {compNorm(q+1+yd);  compNorm(q+1+yd+zd); VIntZ((q+1+yd)*3, vlist, nlist, 30, isol, fx2, fy2, fz, field3, field7); }
    if (bits & 2048) {compNorm(q+yd);    compNorm(q+yd+zd);   VIntZ((q+yd)*3,   vlist, nlist, 33, isol, fx,  fy2, fz, field2, field6); }

    cubeindex <<= 4  // Re-purpose cubeindex into an offset into triTable.
    var numtris = 0, i = 0;
    while (triTable[cubeindex + i] != -1) {
      imm.posnormvoff(vlist, nlist, 3 * triTable[cubeindex + i + 0]); imm.next()
      imm.posnormvoff(vlist, nlist, 3 * triTable[cubeindex + i + 1]); imm.next()
      imm.posnormvoff(vlist, nlist, 3 * triTable[cubeindex + i + 2]); imm.next()
      i += 3;
      numtris++;
    }
    return numtris;
  }
  
  var firstDraw = true

  this.render = function(framebuffer, time, global_time) {
    m4.rotationY(world, time * 0.2)
    m4.translate(world, [0, 0*Math.sin(time)*0.5, 0])
    m4.mul(viewproj, view, proj)
    m4.mul(worldviewproj, world, viewproj)

    gl.clearColor(0.2,0.15,0.12,1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)

    var uniformsConst = {
      u_worldviewproj: worldviewproj,
      u_lightDir: [1.0, 1.0, 1.0],
      u_lightColor: [0.8, 0.7, 0.6, 0.0],
      u_ambientUp: [0.05, 0.1, 0.2, 0.0],
      u_ambientDown: [0.15, 0.075, 0.01, 0.0],
    }
    var uniformsPer = {
      u_worldviewproj: worldviewproj
    }

    model.drawPrep(uniformsConst)

    // Wipe the normal cache.
    for (var i = 0; i < size * size * size; i++) {
      normal_cache[i * 3] = 0.0
    }
    if (firstDraw) {
      // Uncomment to check the speed impact of the field filling.
      // firstDraw = false
      for (var i = 0; i < size * size * size; i++) {
        field[i] = 0.0
      }
      // Fill the field with some metaballs. Could be optimized using balls
      // that fade out to zero, and bounding boxes.
      //
      // TODO: fix this optimization stuff, it doesn't work yet
      //
      // Let's solve the equation to find the radius:
      // 1.0 / (0.000001 + radius^2) * strength - subtract = 0
      // strength / (radius^2) = subtract
      // strength = subtract * radius^2
      // radius^2 = strength / subtract
      // radius = sqrt(strength / subtract)
      for (var i = 0; i < 5; i++) {
        var ballx = Math.sin(i + time * (1 + 0.1 * i)) * 0.25 + 0.5;
        var bally = Math.cos(i + time * (1.2 + 0.14 * i)) * 0.25 + 0.5;
        var ballz = Math.cos(i + time * (0.9 + 0.23 * i)) * 0.25 + 0.5;
        var subtract = 12
        var strength = 1.2
        var radius = size * Math.sqrt(strength / subtract)
        var min_z = 1 //ballz * size - radius; if (min_z < 1) min_z = 1
        var max_z = size - 1 //ballz * size + radius; if (max_z > size - 1) max_z = size - 1
        var min_y = 1 // bally * size - radius; if (min_y < 1) min_y = 1
        var max_y = size - 1 // bally * size + radius; if (max_y > size - 1) max_y = size - 1
        var min_x = 1 // ballx * size - radius; if (min_x < 1) min_x = 1
        var max_x = size - 1 //ballx * size + radius; if (max_x > size - 1) max_x = size - 1
        // Don't polygonize in the outer layer because normals aren't
        // well-defined there.
        for (var z = min_z; z < max_z; z++) {
          var z_offset = size * size * z;
          var fz = z / size - ballz
          for (var y = min_y; y < max_y; y++) {
            var y_offset = z_offset + size * y;
            var fy = y / size - bally
            for (var x = min_x; x < max_x; x++) {
              var fx = x / size - ballx
              var val = 1.0 / (0.000001 + fx*fx + fy*fy + fz*fz) * strength - subtract
              if (val > 0.0) field[y_offset + x] += val
            }
          }
        }
      }
    }

    var isol = 80.0

    imm.begin(gl.TRIANGLES, program)

    // Triangulate. Yeah, this is slow.
    var size2 = size / 2.0
    for (var z = 0; z < size - 1; z++) {
      var z_offset = size * size * z;
      var fz = (z - size2) / size2 //+ 1
      for (var y = 0; y < size - 1; y++) {
        var y_offset = z_offset + size * y;
        var fy = (y - size2) / size2 //+ 1
        for (var x = 0; x < size - 1; x++) {
          var fx = (x - size2) / size2 //+ 1
          var q = y_offset + x
          polygonize(fx, fy, fz, q, isol)
        }
      }
    }
    imm.end()
  }
}
