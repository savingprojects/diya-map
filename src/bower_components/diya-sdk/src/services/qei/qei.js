/* maya-client
 *
 * Copyright (c) 2014, Partnering Robotics, All rights reserved.
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; version
 *  3.0 of the License. This library is distributed in the hope
 * that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE. See the GNU Lesser General Public License for more details.
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 */



var util = require('util');


var Message = require('../message');

/**
 *  callback : function called after model updated
 * */
function QEI(node, callback, sampling){
	var that = this;
	this.node = node;
	
	this.sampling = sampling || 10; /* max num of pts stored */
	this.callback = callback || function(res){}; /* callback, usually after getModel */

	node.get({
		service: "qei",
		func: "DataRequest",
		data: {
			type:"msgInit",
			sampling: 1,
			requestedData: "all"
			/* no time range specified */
			}
		}, function(data){
			that.dataModel= {};
			// console.log(JSON.stringify(that.dataModel));
			that._getDataModelFromRecv(data);
			// console.log(JSON.stringify(that.dataModel));
			
			/// that.updateChart(this.dataModel);
			that._updateLevels(that.dataModel);
			that.callback(that.dataModel);

			node.listen({
					service: "qei",
					func: "SubscribeQei"
				}, function(res) {
					that._getDataModelFromRecv(res.data);
					that._updateLevels(that.dataModel);
					that.callback(that.dataModel);
					});
	});

	console.log("DiyaSDK - QEI: created");
	return this;
}
/**
 * Get dataModel : 
 * {
 * 	time: [FLOAT, ...],
 * 	"senseurXX": {
 * 			data:[FLOAT, ...],
 * 			qualityIndex:[FLOAT, ...],
 * 			range: [FLOAT, FLOAT],
 * 			unit: FLOAT
 * 		},
 *   ... ("senseursYY")
 * }
 */
QEI.prototype.getDataModel = function(){
	return this.dataModel;
}
QEI.prototype.getDataRange = function(){
	return this.dataModel.range;
}
QEI.prototype.updateQualityIndex = function(){
	var that=this;
	var dm = this.dataModel;
	
	for(var d in dm) {
		if(d=='time' || !dm[d].data) continue;
	
		if(!dm[d].qualityIndex || dm[d].data.length != dm[d].qualityIndex.length)
			dm[d].qualityIndex = new Array(dm[d].data.length);
		
		dm[d].data.forEach(function(v,i) {
				dm[d].qualityIndex[i] = checkQuality(v,dm[d].qualityConfig);
			});
	}
}

QEI.prototype.getDataconfortRange = function(){
	return this.dataModel.confortRange;
}
QEI.prototype.getSampling = function(numSamples){
	return this.sampling;
}
QEI.prototype.setSampling = function(numSamples){
	this.sampling = numSamples;
}



QEI.prototype._updateConfinementLevel = function(model){
	var co2 = model['CO2'].data[model['CO2'].data.length - 1];
	var voct = model['VOCt'].data[model['VOCt'].data.length - 1];
	var confinement = Math.max(co2, voct);

	if(confinement < 800){
		return 3;
	}
	if(confinement < 1600){
		return 2;
	}
	if(confinement < 2400){
		return 1;
	}
	if(confinement < 3000){
		return 0;
	}
}

QEI.prototype._updateAirQualityLevel = function(confinement, model){
	var fineDustQualityIndex = model['Fine Dust'].qualityIndex[model['Fine Dust'].qualityIndex.length-1];
	var ozoneQualityIndex = model['Ozone'].qualityIndex[model['Ozone'].qualityIndex.length-1];

	var qualityIndex = fineDustQualityIndex + ozoneQualityIndex;
	if(qualityIndex < 2) return confinement - 1;
	else return confinement;
}

QEI.prototype._updateEnvQualityLevel = function(airQuality, model){
	var humidityQualityIndex = model['Humidity'].qualityIndex[model['Humidity'].qualityIndex.length-1];
	var temperatureQualityIndex = model['Temperature'].qualityIndex[model['Temperature'].qualityIndex.length-1];

	var qualityIndex = humidityQualityIndex + temperatureQualityIndex;
	if(qualityIndex < 2) return airQuality - 1;
	else return airQuality;	
}

QEI.prototype._updateLevels = function(model){
	this.confinement = this._updateConfinementLevel(model);
	this.airQuality = this._updateAirQualityLevel(this.confinement, model);
	this.envQuality = this._updateEnvQualityLevel(this.airQuality, model);
}

QEI.prototype.getConfinementLevel = function(){
	return this.confinement;
}

QEI.prototype.getAirQualityLevel = function(){
	return this.airQuality;
}

QEI.prototype.getEnvQualityLevel = function(){
	return this.envQuality;
}


var checkQuality = function(data, qualityConfig){
	var quality;
	if(data && qualityConfig) {
		if(data>qualityConfig.confortRange[1] || data<qualityConfig.confortRange[0])
			quality=0;
		else
			quality=1.0
		return quality;
	}
	return 1.0;
}

/**
 * Update internal model with received data
 * @param  {Object} data data received from DiyaNode by websocket
 * @return {[type]}     [description]
 */
QEI.prototype._getDataModelFromRecv = function(data){
	var dataModel=this.dataModel;
	/*\
	|*|
	|*|  utilitaires de manipulations de chaînes base 64 / binaires / UTF-8
	|*|
	|*|  https://developer.mozilla.org/fr/docs/Décoder_encoder_en_base64
	|*|
	\*/
	/** Decoder un tableau d'octets depuis une chaîne en base64 */
	b64ToUint6 = function(nChr) {
		return nChr > 64 && nChr < 91 ?
				nChr - 65
			: nChr > 96 && nChr < 123 ?
				nChr - 71
			: nChr > 47 && nChr < 58 ?
				nChr + 4
			: nChr === 43 ?
				62
			: nChr === 47 ?
				63
			:	0;
	};
	/**
	 * Decode base64 string to UInt8Array
	 * @param  {String} sBase64     base64 coded string
	 * @param  {int} nBlocksSize size of blocks of bytes to be read. Output byteArray length will be a multiple of this value.
	 * @return {Uint8Array}             tab of decoded bytes
	 */
	base64DecToArr = function(sBase64, nBlocksSize) {
		var
		sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
		nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2,
		buffer = new ArrayBuffer(nOutLen), taBytes = new Uint8Array(buffer);

		for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
			nMod4 = nInIdx & 3; /* n mod 4 */
			nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
			if (nMod4 === 3 || nInLen - nInIdx === 1) {
				for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
					taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
				}
				nUint24 = 0;

			}
		}
		// console.log("u8int : "+JSON.stringify(taBytes));
		return buffer;
	};
	
	if(data && data.header) {
		//~ console.log('rcvdata '+JSON.stringify(data));
		// if(!data.header.sampling) data.header.sampling=1;
		
		/** case 1 : 1 value received added to dataModel */
		if(data.header.sampling==1) {
			if(data.header.timeEnd) {
				if(!dataModel.time) dataModel.time=[];
				dataModel.time.push(data.header.timeEnd);
				if(dataModel.time.length > this.sampling) {
					dataModel.time = dataModel.time.slice(dataModel.time.length - this.sampling);
				}
			}
			for (var n in data) {
				if(n != "header" && n != "time") {
					// console.log(n);
					if(!dataModel[n]) {
						dataModel[n]={};
						dataModel[n].data=[];
					}

					/* update data range */
					dataModel[n].range=data[n].range;
					/* update data label */
					dataModel[n].label=data[n].label;
					/* update data unit */
					dataModel[n].unit=data[n].unit;
					/* update data confortRange */
					dataModel[n].qualityConfig={confortRange: data[n].confortRange};

					if(data[n].data.length > 0) {
						/* decode data to Float32Array*/
						var buf = base64DecToArr(data[n].data, 4);
						// console.log(JSON.stringify(buf));
						var fArray = new Float32Array(buf);

						if(data[n].size != fArray.length) console.log("Mismatch of size "+data[n].size+" vs "+fArray.length);
						if(data[n].size != 1) console.log("Expected 1 value received :"+data[n].size);
						
						if(!dataModel[n].data) dataModel[n].data=[];
						dataModel[n].data.push(fArray[0]);
						if(dataModel[n].data.length > this.sampling) {
							dataModel[n].data = dataModel[n].data.slice(dataModel[n].data.length - this.sampling);
						}
					}
					else {
						if(data[n].size != 0) console.log("Size mismatch received data (no data versus size="+data[n].size+")");
						dataModel[n].data = [];
					}
					this.updateQualityIndex();
					//~ console.log('mydata '+JSON.stringify(dataModel[n].data));
				}
			}
		}
		else {
			/** case 2 : history data - many values received */
			/** TODO  */
			for (var n in data) {
				if(n == 'time') {
					/* case 1 : time data transmitted, 1 value */
					/** TODO **/
				}
				else if(n != "header") {
					// console.log(n);
					if(!dataModel[n]) {
						dataModel[n]={};
						dataModel[n].data=[];
					}

					/* update data range */
					dataModel[n].range=data[n].range;
					/* update data label */
					dataModel[n].label=data[n].label;
					/* update data unit */
					dataModel[n].unit=data[n].unit;
					/* update data confortRange */
					dataModel[n].qualityConfig={confortRange: data[n].confortRange};

					if(data[n].data.length > 0) {
						/* decode data to Float32Array*/
						var buf = base64DecToArr(data[n].data, 4); 
						// console.log(JSON.stringify(buf));
						var fArray = new Float32Array(buf);

						if(data[n].size != fArray.length) console.log("Mismatch of size "+data[n].size+" vs "+fArray.length);
						// /* increase size of data if necessary */
						if(fArray.length>dataModel[n].data.length) {
							// dataModel[n].size=data[n].size;
							dataModel[n].data = new Array(dataModel[n].size);
						}
						/* update nb of samples stored */
						for(var i in fArray) {
							dataModel[n].data[parseInt(i)]=fArray[i]; /* keep first val - name of column */
						}
					}
					else {
						if(data[n].size != 0) console.log("Size mismatch received data (no data versus size="+data[n].size+")");
						dataModel[n].data = [];
					}
					// dataModel[n].data = Array.from(fArray);
					// console.log('mydata '+JSON.stringify(dataModel[n].data));
				}
			}
		}
	}
	else {
		console.log("No Data to read or header is missing !");
	}
	return this.dataModel;
}


var exp = {
		QEI: QEI
}

module.exports = exp; 
