Polymer('diya-map', {
	ready: function(){
		this.radians = Math.PI/180;
		this.degrees = 180/Math.PI;
		this.odoMaxValue = 5000;
		this.PLACE_ACTIVATION_THRESOLD = 0.2;
		this.initDragPlaceBehavior();
		this.zoomAll(this.$.content, [5000, 5000]);
		this.places = [];
		this.path = {};
		this.currentPosition = {};
		this.updatePlaces();
		this.edit = {map: false, singlePlace: false, allPlaces: false};
		this.setBase();
	},
	
	setBase: function(){	
		var base = d3.select(this.$.places);
		base.append('svg:circle')
		  .style('fill','pink')
		  .attr('class','base')
		  .attr('cx', 0)
		  .attr('cy', 0)
		  .attr('r', this.odoMaxValue/100);
	  },
		
	uncallBehavior: function(group){
		group.on("mousedown.zoom", null);
		group.on("mousemove.zoom", null);
		group.on("dblclick.zoom", null);
		group.on("touchstart.zoom", null);
		group.on("wheel.zoom", null);
		group.on("mousewheel.zoom", null);
		group.on("MozMousePixelScroll.zoom", null);
	},
	
	zoomAll: function(group, focal){
		var that = this;
		this.uncallBehavior(d3.select(this.$.map));
		this.zoom = d3.behavior.zoom()
			.scaleExtent([0.1,20])
			.center(focal)
			.on('zoom', function(){
				console.log('tx: '+d3.event.translate[0]+' ty: '+d3.event.translate[1]);	
					var x = d3.event.translate[0];
					var y = d3.event.translate[1];
					var scale = d3.event.scale;
					if(that.editMode()){
						console.log('x: '+that.path.x+' y: '+that.path.y);
						x += that.path.x;
						y += that.path.y;
						console.log('x: '+x+' y: '+y);
					}
					if(!that.editMode()){
					}
					d3.select(group)
						.attr('transform', 'translate('+x+','+y+'), scale('+scale+')');
			})
		d3.select(this.$.map).call(this.zoom);
	},
	
	editMode: function(){
		if(this.edit.map||this.edit.singlePlace||this.edit.allPlaces)
			return true;
		else
			return false;
	},			
			
	editPlaces: function(single, all){
		console.log(this.path);
		this.edit.singlePlace = single;
		this.edit.allPlaces = all;
		this.uncallBehavior(d3.select(this.$.map));
		this.editMode()?this.zoomAll(this.$.places, [0, 0]):this.zoomAll(this.$.content, [5000,5000]);
	},

	fitMap: function(fit){
		var that = this;
		this.edit.map = fit;		
	},
	
	findWinner: function(value, index, ar){
		if(value.winner) return true;
		return false;
	},
	
	//Drag n Drop for Places	
	initDragPlaceBehavior: function(){
		var that = this;
		this.dragPlaceBehavior = d3.behavior.drag()					
			.on('dragstart', function(){
				d3.event.sourceEvent.stopPropagation();
			})
			.on('drag', function(){
				if(that.edit.singlePlace){
					console.log(d3.event);
					d3.select(this)
						.attr('cx', function(d){ return d.x = d3.event.x; })
						.attr('cy', function(d){ return d.y = d3.event.y; })				
				}					  
			});
	},

	addPlace: function(x, y, value, winner){
		var that = this;
		var remotePlace = this.getRemotePlace(this.places.length);
		if(remotePlace){
			x = remotePlace.x;
			y = remotePlace.y;		}
		this.places.push({x: x, y: y, value: value, winner: winner});
	},

	setCurrentPlace: function(id, pos){
		if(id >= this.places.length) return;
		for(var i = 0; i<this.places.length; i++){
			this.places[i].winner = false;
		}
		this.places[id].winner = true;
	},

	updatePlace: function(id, value){
		if(id < this.places.length){
			this.places[id].value = value;
			return false;
		}
		else if(id === this.places.length && value > this.PLACE_ACTIVATION_THRESOLD){
			var vx;
			var vy;
			vx = this.currentPosition.x;
			vy = this.currentPosition.y;
			this.addPlace(vx, vy, value, false);
			return true;
		}else{
			return false; //Should not happen
		}
	},

	updatePlaces: function(){
		var that = this;
		var placeElements = d3.select(this.$.places)
		  .selectAll('.place')
		  .data(this.places);
		placeElements.enter()
		  .append('svg:circle')
		  .call(this.dragPlaceBehavior);
		placeElements.exit().remove();
		placeElements.attr('class', 'place')
		  .attr('cx', function(d) { return d.x; })
		  .attr('cy', function(d) { return d.y; })
		  .attr('r', function(d) { return (that.editMode() ? that.odoMaxValue/100/that.path.scale:that.odoMaxValue/500); }) //d.value * 50
		  .attr('fill', function(d) { return d.winner ? 'green' : 'black'});
	},

	diyaChanged: function(){
		if(this.diya){
			this.diyaConnected(this.diya);
		}else{
			this.diyaDisconnected();
		}
	},

	diyaConnected: function(diya){
		this.connectPromethe();
		this.getDefaultMap();
	},

	diyaDisconnected: function(){
		
	},

	getDefaultMap: function(){
		var that = this;
		this.diya.listen({
			service: 'maps',
			func: 'ListenMap',
			obj: ['default']
		},function(data){
			if(data == null) return ;
			that.currentMapId = data.id;
			that.path = {x: data.tx, y: data.ty, scale: data.scale};
			console.log(that.path);
			d3.select(that.$.places).attr('transform', 'translate('+data.tx+','+data.ty+'), scale('+data.scale+')');
			for(var i = 0; i<data.places.length; i++){
				var place = that.places[data.places[i].neuronId];
				if(!place) continue ;
				place.x = data.places[i].x;
				place.y = data.places[i].y;
				place.label = data.places[i].label;
			}
			that.remotePlaces = data.places;
			that.updatePlaces();
		});
	},

	getRemotePlace: function(id){		
		if(this.remotePlaces === undefined) return null;
		for(var i = 0; i<this.remotePlaces.length; i++){
			if(this.remotePlaces[i].neuronId === id) return this.remotePlaces[i];
		}
		return null;
	},

	savePlaces: function(id){	
		var t = d3.transform(d3.select(this.$.places).attr('transform'));
		this.diya.get({
			service: 'maps',
			func: 'UpdateMap',
			obj: [ 'default' ],
			data: {
				scale: t.scale[0],
				tx: t.translate[0],
				ty: t.translate[1]
			}
		})
		for(var i=0; i<this.places.length; i++){
			this.diya.get({
				service: 'maps',
				func: 'UpdatePlace',
				data: {
					mapId: this.currentMapId,
					neuronId: i,
					x: this.places[i].x,//*Math.cos(this.$.mapImage.rotation*this.radians),
					y: this.places[i].y//*Math.sin(this.$.mapImage.rotation*this.radians)
				}
			},function(data){});
		}
	},

	clearPlaces: function(){
		this.diya.get({
			service: 'maps',
			func: 'ClearMap',
			obj: [ 'default' ]
		});
	},	

	connectPromethe: function(){
		var that = this;
		this.promethe = new diya.Promethe(this.diya);
		
		this.promethe.use(/^map\.places$/, function(neuron){
			if(neuron.type === 'input')
				that.setPlaceNeuron(neuron);
			else
				console.log("error map.places should be an input");
		});
		
		this.promethe.use(/^map\.odometry$/, function(neuron){
			if(neuron.type === 'input')
				that.setOdometryNeuron(neuron);
			else
				console.log("error map.places should be an input");
		});

		this.promethe.connect();
	},
	
	setOdometryNeuron: function(neuron){
		var that = this;		
		neuron.setOnValue(function(msg){
			var diyaPos = new DataView(msg.data);			
			for(var i=0; i<neuron.size; i++){
				value = diyaPos.getFloat32(i*4, true);
				that.setcurrentPosition(value, i);
			}
			that.updatecurrentPosition();
		});
	},
	
		
	updatecurrentPosition: function(){	
		var win = this.places.filter(this.findWinner);
		var that = this;
		var diya = d3.select(this.$.diya)
			.selectAll('.diya')
			.data(win);
		diya.enter()
		  .append('svg:circle');
		diya.attr('class', 'diya')
		  .attr('cx', function(d) { return d.x-10;})
		  .attr('cy', function(d) { return d.y-10;})
		  .attr('r', 10)
		  .attr('fill', function(d) { return 'red'});		  
	  },

	setPlaceNeuron: function(neuron){
		var that = this;
		neuron.setOnValue(function(msg){
			var placeNeurons = new DataView(msg.data);
			var maxId = 0;
			var newPlace = false;
			for(var i=0; i<neuron.size; i++){
				var value = placeNeurons.getFloat32(i*4, true);
				newPlace = that.updatePlace(i, value);
				if(value > placeNeurons.getFloat32(maxId*4, true)) maxId = i;
			}
			that.setCurrentPlace(maxId, that.currentPosition);
			that.updatePlaces();
		});
	},
	
	setcurrentPosition: function(value, i){
		switch(i){
			case 0: this.currentPosition.x = value; break;
			case 1: this.currentPosition.y = value; break;
			case 2: this.currentPosition.t = value; break;
			default:break;		
		}
	}
});
