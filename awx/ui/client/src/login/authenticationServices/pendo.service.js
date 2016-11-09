/*************************************************
* Copyright (c) 2015 Ansible, Inc.
*
* All Rights Reserved
*************************************************/


export default
   [ '$rootScope', '$pendolytics', 'Rest', 'GetBasePath', 'ProcessErrors', '$q',
        'ConfigService', '$log',
   function ($rootScope, $pendolytics, Rest, GetBasePath, ProcessErrors, $q,
        ConfigService, $log) {
       return {
            setPendoOptions: function (config) {
                var tower_version = config.version.split('-')[0],
                trial = (config.trial) ? config.trial : false,
                options = {
                    visitor: {
                      id: null,
                      role: null,
                      email: null
                    },
                    account: {
                      id: null,
                      planLevel: config.license_type,
                      planPrice: config.instance_count,
                      creationDate: config.license_date,
                      trial: trial,
                      tower_version: tower_version,
                      ansible_version: config.ansible_version
                    }
                };
                if(config.analytics_status === 'detailed'){
                    this.setDetailed(options, config);
                }
                else if(config.analytics_status === 'anonymous'){
                    this.setAnonymous(options);
                }
                return options;

            },

            setDetailed: function(options, config) {
                // Detailed mode
                    // VisitorId: username+hash of license_key
                    // AccountId: hash of license_key from license
                    // email: contact_email from license OR email from Tower account

                options.visitor.id = $rootScope.current_user.username + '@' + config.deployment_id;
                options.account.id = config.deployment_id;
                options.visitor.email = $rootScope.current_user.email;
            },

            setAnonymous: function (options) {
                //Anonymous mode
                    // VisitorId: <some hardcoded id that is the same across all anonymous>
                    // AccountId: <some hardcoded id that is the same across all anonymous>
                    // email: <blank>

                options.visitor.id = 0;
                options.account.id = "tower.ansible.com";
                options.visitor.email = "";
            },

            setRole: function(options) {
                var deferred = $q.defer();
                if($rootScope.current_user.is_superuser === true){
                    options.visitor.role = 'admin';
                    deferred.resolve(options);
                }
                else{
                    var url = GetBasePath('users') + $rootScope.current_user.id + '/admin_of_organizations/';
                    Rest.setUrl(url);
                    var promise = Rest.get();
                    promise.then(function (response) {
                        if(response.data.count > 0 ) {
                            options.visitor.role = "orgadmin";
                            deferred.resolve(options);
                        }
                        else {
                            options.visitor.role = "user";
                            deferred.resolve(options);
                        }
                    });
                    promise.catch(function (response) {
                        ProcessErrors($rootScope, response.data, response.status, null, {
                            hdr: 'Error!',
                            msg: 'Failed to get inventory name. GET returned status: ' +
                            response.status });
                        deferred.reject('Could not resolve pendo role.');
                    });
                }
                return deferred.promise;
            },

            issuePendoIdentity: function () {
                var options,
                    c = ConfigService.get(),
                    config = c.license_info;

                config.analytics_status = c.analytics_status;
                config.version = c.version;
                config.ansible_version = c.ansible_version;
                if(config.analytics_status === 'detailed' || config.analytics_status === 'anonymous'){
                    $pendolytics.bootstrap();
                    options = this.setPendoOptions(config);
                    this.setRole(options).then(function(options){
                        $log.debug('Pendo status is '+ config.analytics_status + '. Object below:');
                        $log.debug(options);
                        $pendolytics.identify(options);
                    }, function(reason){
                        // reject function for setRole
                        $log.debug(reason);
                    });
                }
                else {
                    $log.debug('Pendo is turned off.');
                }
             }
        };
   }
];
