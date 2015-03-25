
DIST=dist/diya-map/usr/lib/diya-map




all:
	cd src && bower install

prepare-package:
	cp -R src/* $(DIST)/
	cp -R nginx-config dist/diya-map/etc/nginx/sites-available/map
	ln -sf ../sites-available/map dist/diya-map/etc/nginx/sites-enabled/map


