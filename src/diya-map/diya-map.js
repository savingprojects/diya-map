Polymer('diya-map', {
	ready: function(){
		var that = this;
		this.PLACE_ACTIVATION_THRESOLD = 0.2;
		this.initMapNavigation();
		this.initDragPlaceBehavior();
		this.places = [];
		this.currentPosition = {};
		this.updatePlaces();
		this.currentPlaceId = 0;
		this.fitmap = false;
		this.editplaces = false;
		
	},
	
	editPlaces: function(edit){
		this.editplaces = edit;
	},

	fitMap: function(fit){
		this.fitmap = fit;
		if(!fit && this.diya){
			this.diya.get({
				service: 'maps',
				func: 'UpdateMap',
				obj: [ 'default' ],
				data: {
					scale: this.$.mapImage.scale,
					tx: this.$.mapImage.tx,
					ty: this.$.mapImage.ty
				}
			})
		}
	},
	
	findWinner: function(value, index, ar){
		if(value.winner) return true;
		return false;
	},
		
	updatecurrentPosition: function(){	
		console.log(this.$.mapImage.scale);	
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
		  .attr('fill', function(d) { return 'red'})
		  .append('svg:circle')
		  .attr('cx', function(d) { return d.x-20;})
		  .attr('cy', function(d) { return d.y-20;})
		  .attr('r', 10)
		  .attr('fill', function(d) { return 'orange'});
		  
	  },
	
	//Drag n Drop for Places	
	initDragPlaceBehavior: function(){
		var that = this;
		this.dragPlaceBehavior = d3.behavior.drag()					
			.on('dragstart', function(){
				sx = this.attributes.cx.value;
				sy = this.attributes.cy.value;
				d3.event.sourceEvent.stopPropagation();
			})
			.on('drag', function(){
				if(that.editplaces){
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
			y = remotePlace.y;
		}
		this.places.push({x: x, y: y, value: value, winner: winner});
	},

	setCurrentPlace: function(id, pos){
		if(id >= this.places.length) return;
		this.currentPlaceId = id;
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
		  .attr('r', function(d) { return that.editplaces ? 10:5; }) //d.value * 50
		  .attr('fill', function(d) { return d.winner ? 'green' : 'black'});
	},

	//Init map translation and zoom
	initMapNavigation: function(){
		var that = this;
		this.$.mapImage.tx = 0;
		this.$.mapImage.ty = 0;
		this.$.mapImage.scale = 1;

		function updateMapContent(){
			var x = d3.event.translate[0];
			var y = d3.event.translate[1];
			var scale = d3.event.scale;
			d3.select(that.$.mapContent)
				.attr('transform', 'translate('+x+','+y+'), scale('+scale+')');
		}

		function updateMapImage(){
			var x = d3.event.translate[0];
			var y = d3.event.translate[1];
			var scale = d3.event.scale;
			d3.select(that.$.mapImage)
				.attr('transform', 'translate('+x+','+y+'), scale('+scale+')');
			that.$.mapImage.tx = x;
			that.$.mapImage.ty = y;
			that.$.mapImage.scale = scale;
		}

		//zoom in/out for the whole map
		this.zoomMapBehavior = d3.behavior.zoom()
			.scaleExtent([0.1,20])
			.on('zoom', function(){
				if(that.fitmap){
					updateMapImage();
				}else{
					updateMapContent();
				}
			})

		d3.select(this.$.map)
			.call(this.zoomMapBehavior);
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
			//console.log(data.tx+":"+data.ty+":"+data.scale);
			d3.select(that.$.mapImage)
				.attr('transform', 'translate('+data.tx+','+data.ty+'), scale('+data.scale+')');
			//Set saved places
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
		for(var i=0; i<this.places.length; i++){
			this.diya.get({
				service: 'maps',
				func: 'UpdatePlace',
				data: {
					mapId: this.currentMapId,
					neuronId: i,
					x: this.places[i].x,
					y: this.places[i].y
				}
			},function(data){
				//Succeed / fail ?
			});
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
		});
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
		this.updatecurrentPosition();
	}
});
